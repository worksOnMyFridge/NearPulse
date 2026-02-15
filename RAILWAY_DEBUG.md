# 🔍 Railway Debugging Guide

## Проблема
Railway деплоит успешно, но API возвращает 500 ошибки.

---

## 🧪 Шаг 1: Проверка базового endpoint

Откройте в браузере:
```
https://nearpulse-production.up.railway.app/api/health
```

### Если видите JSON:
```json
{
  "status": "ok",
  "timestamp": 1708012345678
}
```
✅ **Сервер работает!** Проблема в конкретных endpoints.

### Если видите ошибку:
❌ **Сервер не запустился!** Смотрите Deploy Logs.

---

## 📋 Шаг 2: Проверка переменных окружения

1. Откройте Railway Dashboard
2. Ваш проект → **Variables**
3. Убедитесь что есть ВСЕ переменные:

```
TELEGRAM_BOT_TOKEN=...
NEARBLOCKS_API_KEY=(может быть пустым)
GOOGLE_API_KEY=...
PIKESPEAK_API_KEY=...
WEBAPP_URL=https://near-pulse.vercel.app/
API_PORT=3001
```

⚠️ **Если чего-то не хватает** → добавьте и нажмите **Redeploy**

---

## 🔍 Шаг 3: Проверка Deploy Logs

1. Railway Dashboard → ваш проект
2. Вкладка **Deploy Logs** (НЕ Build Logs!)
3. Ищите строки с ошибками (красного цвета)

### Типичные ошибки:

#### Ошибка 1: `Cannot find module`
```
Error: Cannot find module './services/nearService'
```
**Решение:** Файл не добавлен в Git
```bash
git add src/services/nearService.js
git commit -m "fix: add missing file"
git push origin master
```

#### Ошибка 2: `NEARBLOCKS_API_KEY is not defined`
**Решение:** Добавить переменную в Railway Variables

#### Ошибка 3: `ECONNREFUSED`
```
Error: connect ECONNREFUSED
```
**Решение:** Внешний API (Nearblocks/Pikespeak) недоступен
- Проверьте API ключи
- Проверьте доступность: `curl https://api.nearblocks.io/v1/health`

#### Ошибка 4: `Port already in use`
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Решение:** Проблема с Railway, нажмите **Restart**

---

## 🧪 Шаг 4: Локальное тестирование

Проверьте, работает ли API локально:

```bash
cd "c:/Users/la1wo/OneDrive/Рабочий стол/web3/near-analytics-bot"

# Установить зависимости
npm install

# Запустить API
npm run api
```

Откройте: `http://localhost:3001/api/health`

### Если работает локально, но не на Railway:
→ Проблема в конфигурации Railway или переменных окружения

### Если НЕ работает локально:
→ Проблема в коде, нужно искать баг

---

## 🔧 Шаг 5: Временный фикс (добавить больше логов)

Добавьте логирование в `src/api.js`:

```javascript
// В начале файла, после require
console.log('🚀 Starting NearPulse API...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('📍 Port:', PORT);

// В каждом endpoint, в catch блоке:
catch (error) {
  console.error('[API ERROR]', req.path, error.message);
  console.error('[STACK]', error.stack);
  res.status(500).json({ error: 'Internal server error' });
}
```

Коммит и push → смотрите Deploy Logs → увидите точную ошибку!

---

## ⚡ Быстрые тесты

Запустите:
```bash
./test-railway.bat
```

Или вручную:
```bash
curl https://nearpulse-production.up.railway.app/api/health
curl https://nearpulse-production.up.railway.app/api/balance/leninjiv23.tg
```

---

## 📞 Если ничего не помогает

1. Покажите мне **полный Deploy Log** (скриншот или текст)
2. Покажите Railway **Variables** (скрыв секретные ключи)
3. Покажите результат `curl https://nearpulse-production.up.railway.app/api/health`

Тогда я точно найду проблему! 🔍

---

## 🎯 Контрольный список

- [ ] Railway успешно деплоит (Build Logs зелёные)
- [ ] `/api/health` возвращает 200 OK
- [ ] Все переменные окружения добавлены
- [ ] Deploy Logs не показывают ошибок
- [ ] Внешние API (Nearblocks, Pikespeak) доступны

Если все галочки ✅ → API должен работать!
