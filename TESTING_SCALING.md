# 🧪 Тестирование Production Scaling

## Обзор

Полное руководство по тестированию новой On-Demand архитектуры.

---

## 🔧 Подготовка

### 1. Локальный запуск

```bash
# Backend
cd near-analytics-bot
npm install
npm run api

# Frontend (новый терминал)
cd webapp
npm install
npm run dev
```

### 2. Production endpoints

- **API**: `https://your-bot.railway.app`
- **Frontend**: `https://near-pulse.vercel.app`

---

## 📋 Тесты

### Test 1: Health Check + Cache Stats

**Команда**:
```bash
curl https://your-bot.railway.app/api/health
```

**Ожидаемый ответ**:
```json
{
  "status": "healthy",
  "timestamp": 1708012345678,
  "uptime": 123.456,
  "cache": {
    "totalEntries": 25,
    "activeEntries": 20,
    "expiredEntries": 5,
    "hitRate": 80
  },
  "memory": {
    "used": 45,
    "total": 128,
    "unit": "MB"
  }
}
```

**Критерии успеха**:
- ✅ `status: "healthy"`
- ✅ `cache.hitRate` > 70% (после прогрева)
- ✅ `memory.used` < 256 MB

---

### Test 2: NFT Counter (Fast)

**Команда**:
```bash
time curl https://your-bot.railway.app/api/nfts/count/leninjiv23.tg
```

**Ожидаемый ответ**:
```json
{
  "address": "leninjiv23.tg",
  "total": 10450,
  "wallet": 10450,
  "hotStaked": 0,
  "timestamp": 1708012345678
}
```

**Критерии успеха**:
- ✅ Ответ за **< 2 секунды** (первый раз)
- ✅ Ответ за **< 0.5 секунды** (из кэша)
- ✅ `total` > 0

**Проверка кэша**:
```bash
# Первый запрос (медленно)
time curl https://your-bot.railway.app/api/nfts/count/leninjiv23.tg

# Второй запрос (быстро, из кэша)
time curl https://your-bot.railway.app/api/nfts/count/leninjiv23.tg
```

Второй запрос должен быть **в 5-10 раз быстрее**.

---

### Test 3: NFT Pagination (Page 1)

**Команда**:
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=1&limit=50" | jq
```

**Ожидаемый ответ**:
```json
{
  "address": "leninjiv23.tg",
  "wallet": [
    {
      "contract": "near",
      "token_id": "1234",
      "title": "NFT Title",
      "media": "https://ipfs.io/ipfs/Qm..."
    }
    // ... ещё 49 NFT
  ],
  "hotStaked": [
    // HOT Craft NFT (только на странице 1)
  ],
  "total": 10450,
  "page": 1,
  "limit": 50,
  "hasMore": true,
  "error": null,
  "timestamp": 1708012345678
}
```

**Критерии успеха**:
- ✅ `wallet.length` = 50
- ✅ `hasMore` = true
- ✅ `error` = null
- ✅ `hotStaked` присутствует (только на странице 1)

---

### Test 4: NFT Pagination (Page 2+)

**Команда**:
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=2&limit=50" | jq
```

**Ожидаемый ответ**:
```json
{
  "address": "leninjiv23.tg",
  "wallet": [ /* 50 новых NFT */ ],
  "hotStaked": [],
  "total": 10450,
  "page": 2,
  "limit": 50,
  "hasMore": true,
  "error": null
}
```

**Критерии успеха**:
- ✅ `wallet.length` = 50
- ✅ `hotStaked` = [] (пустой, HOT только на странице 1)
- ✅ `hasMore` = true
- ✅ NFT отличаются от страницы 1

---

### Test 5: Последняя страница

**Команда**:
```bash
# Для аккаунта с 10450 NFT, последняя страница = 209 (10450 / 50)
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=209&limit=50" | jq
```

**Ожидаемый ответ**:
```json
{
  "wallet": [ /* 50 NFT */ ],
  "hasMore": false,
  "page": 209
}
```

**Критерии успеха**:
- ✅ `hasMore` = false (это последняя страница)

**Следующая страница (210)**:
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=210&limit=50" | jq
```

**Ожидается**:
```json
{
  "wallet": [],
  "hasMore": false,
  "page": 210
}
```

---

### Test 6: Fail-Safe (Invalid Address)

**Команда**:
```bash
curl -i "https://your-bot.railway.app/api/nfts/invalid-address-123?page=1&limit=50"
```

**Ожидаемый ответ**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "address": "invalid-address-123",
  "wallet": [],
  "hotStaked": [],
  "total": 0,
  "page": 1,
  "limit": 50,
  "hasMore": false,
  "error": "NFT_LOAD_FAILED",
  "message": "..."
}
```

**Критерии успеха**:
- ✅ HTTP статус = **200 OK** (не 500!)
- ✅ `error` = "NFT_LOAD_FAILED"
- ✅ `wallet` = []

---

### Test 7: Fail-Safe (Timeout)

**Симуляция**: Отключите интернет на Railway на 30 секунд (или подождите timeout).

**Команда**:
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=1&limit=50"
```

**Ожидаемый ответ**:
```json
{
  "wallet": [],
  "error": "NFT_TIMEOUT",
  "message": "Request timeout"
}
```

**Критерии успеха**:
- ✅ HTTP статус = **200 OK**
- ✅ `error` = "NFT_TIMEOUT"
- ✅ Приложение не крашится

---

### Test 8: Invalid Pagination Parameters

**Test 8.1**: `page < 1`
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=0&limit=50"
```

**Ожидается**:
```json
{
  "error": "Invalid page",
  "message": "Page must be between 1 and 100"
}
```

**Test 8.2**: `page > 100`
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=101&limit=50"
```

**Ожидается**: тот же ответ.

**Test 8.3**: `limit < 10`
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=1&limit=5"
```

**Ожидается**:
```json
{
  "error": "Invalid limit",
  "message": "Limit must be between 10 and 100"
}
```

**Test 8.4**: `limit > 100`
```bash
curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=1&limit=500"
```

**Ожидается**: тот же ответ.

---

### Test 9: Infinite Scroll (Frontend)

**Шаги**:

1. Откройте https://near-pulse.vercel.app
2. Войдите как `leninjiv23.tg`
3. Перейдите на вкладку **🎨 Галерея**
4. Проверьте:
   - ✅ Видите счётчик: "Всего: 10,450 NFT"
   - ✅ Загружены первые 50 NFT
   - ✅ Нет ошибок 500
5. **Прокрутите вниз**:
   - ✅ Появляется индикатор "Загружаем ещё NFT..."
   - ✅ Автоматически загружаются следующие 50 NFT
   - ✅ Прокрутка плавная (нет зависаний)
6. **Повторите 5 раз**:
   - ✅ Каждый раз загружаются новые 50 NFT
   - ✅ Старые NFT не пропадают
7. **Прокрутите до конца**:
   - ✅ Видите сообщение: "Все NFT загружены (10450)"
   - ✅ Индикатор загрузки больше не появляется

---

### Test 10: Cache Performance

**Цель**: Проверить, что кэш работает.

**Шаги**:

1. **Первый запрос** (холодный старт):
   ```bash
   time curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=1&limit=50" > /dev/null
   ```
   **Ожидается**: 2-5 секунд

2. **Второй запрос** (из кэша):
   ```bash
   time curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=1&limit=50" > /dev/null
   ```
   **Ожидается**: 0.1-0.5 секунд (**в 10-50 раз быстрее**)

3. **Проверить логи Railway**:
   ```bash
   railway logs --tail
   ```
   
   **Искать строки**:
   ```
   💾 [Cache SET] nft_page_leninjiv23.tg_1_50 (TTL: 300s)
   💾 [Cache HIT] nft_page_leninjiv23.tg_1_50 (expires in 250s)
   ```

4. **Подождать 5 минут + 10 секунд**:
   ```bash
   # Кэш должен истечь
   sleep 310
   
   # Новый запрос (снова медленно)
   time curl "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=1&limit=50" > /dev/null
   ```
   **Ожидается**: снова 2-5 секунд (кэш истёк, делается новый запрос)

---

### Test 11: Decoupled APIs (Balance + NFT)

**Цель**: Убедиться, что ошибка NFT не блокирует баланс.

**Симуляция**: Отключите Nearblocks API (или используйте invalid address).

**Команда**:
```bash
# Баланс (должен работать)
curl https://your-bot.railway.app/api/balance/invalid-address-123

# NFT (вернёт Fail-Safe)
curl "https://your-bot.railway.app/api/nfts/invalid-address-123?page=1&limit=50"
```

**Критерии успеха**:
- ✅ Баланс возвращает корректный ответ
- ✅ NFT возвращает `200 OK` с `error: "NFT_LOAD_FAILED"`
- ✅ Приложение не крашится

---

### Test 12: Stress Test (10,000+ NFT)

**Аккаунты для теста**:
- `leninjiv23.tg` (10,450 NFT)
- Или создайте тестовый аккаунт с 10,000+ NFT

**Команда**:
```bash
# Быстрый счётчик
time curl https://your-bot.railway.app/api/nfts/count/leninjiv23.tg

# Загрузить все страницы (скрипт)
for i in {1..210}; do
  echo "Page $i..."
  curl -s "https://your-bot.railway.app/api/nfts/leninjiv23.tg?page=$i&limit=50" | jq '.wallet | length'
  sleep 0.5
done
```

**Критерии успеха**:
- ✅ Все запросы возвращают `200 OK`
- ✅ Нет ошибок 500
- ✅ Нет timeouts
- ✅ Memory usage < 512 MB (проверить в Railway)

---

## 📊 Метрики

### Cache Hit Rate

**Команда**:
```bash
curl https://your-bot.railway.app/api/health | jq '.cache.hitRate'
```

**Критерии**:
- 🟢 Отлично: > 80%
- 🟡 Хорошо: 60-80%
- 🔴 Плохо: < 60%

### Response Time

| Endpoint | Cold Start | Cache Hit | Цель |
|----------|-----------|-----------|------|
| `/nfts/count/:address` | 1-2s | 0.1-0.5s | < 2s |
| `/nfts/:address?page=1` | 3-5s | 0.5-1s | < 5s |
| `/nfts/:address?page=2+` | 2-4s | 0.5-1s | < 5s |

### Memory Usage

**Команда**:
```bash
curl https://your-bot.railway.app/api/health | jq '.memory'
```

**Критерии**:
- 🟢 Отлично: < 128 MB
- 🟡 Хорошо: 128-256 MB
- 🔴 Плохо: > 512 MB

---

## 🐛 Debugging

### Кэш не работает

**Проверить**:
```bash
# Проверить логи
railway logs --tail | grep "Cache"

# Должны видеть:
# 💾 [Cache SET] ...
# 💾 [Cache HIT] ...
```

**Если нет логов**:
- Проверить что `cacheService` импортирован в `api.js`
- Перезапустить Railway

### Медленные запросы

**Проверить**:
1. Nearblocks API работает: `https://api.nearblocks.io/v1/account/near`
2. Railway region близко к серверам Nearblocks (US/EU)
3. Увеличить `API_TIMEOUT` в `.env`

### Ошибки 500

**Проверить**:
- Логи Railway: `railway logs --tail`
- Ошибки в `nearService.js`
- Если ошибка в NFT, проверить что Fail-Safe работает

---

## ✅ Чек-лист финального теста

Перед деплоем в продакшн:

- [ ] Test 1: Health check возвращает cache stats
- [ ] Test 2: NFT counter < 2s
- [ ] Test 3: Pagination page 1 работает
- [ ] Test 4: Pagination page 2+ работает
- [ ] Test 5: Последняя страница `hasMore: false`
- [ ] Test 6: Fail-Safe для invalid address
- [ ] Test 7: Fail-Safe для timeout
- [ ] Test 8: Валидация параметров (page, limit)
- [ ] Test 9: Infinite Scroll в UI
- [ ] Test 10: Cache hit rate > 70%
- [ ] Test 11: Decoupled APIs (balance независим от NFT)
- [ ] Test 12: Stress test 10,000+ NFT

---

## 🎯 Результаты

Заполните после тестирования:

```
✅ Cache hit rate: __%
✅ NFT counter time: __s
✅ NFT page 1 time: __s
✅ Max NFT tested: ____
✅ Memory usage: __ MB
✅ No 500 errors: ☐ Yes ☐ No
```

---

✨ **Production Ready!** Если все тесты пройдены.
