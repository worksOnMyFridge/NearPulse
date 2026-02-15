# 🔍 Отладка Vercel Deploy

## Текущая конфигурация

### vercel.json ✅
```json
{
  "buildCommand": "cd webapp && npm run build",
  "outputDirectory": "webapp/dist",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/api/health", "destination": "/api/index" },
    { "source": "/api/balance/:address", "destination": "/api/index" },
    { "source": "/api/:path*", "destination": "/api/index" }
  ]
}
```

**Что делает:**
- ✅ Собирает frontend: `cd webapp && npm run build`
- ✅ Статика берётся из: `webapp/dist/`
- ✅ API запросы (`/api/*`) → serverless function `api/index.js`

### Структура файлов ✅
```
near-analytics-bot/
├── api/
│   └── index.js           # Serverless function (экспортирует app)
├── src/
│   └── api.js             # Express app (экспортируется если импортируется)
├── webapp/
│   ├── src/
│   │   └── services/
│   │       └── api.js     # API клиент
│   ├── dist/              # Собранный frontend
│   └── package.json
└── vercel.json
```

---

## Проверка локально

### 1. Тест что Express экспортируется без запуска сервера

```bash
node -e "const app = require('./api/index'); console.log('✅ App exported:', typeof app)"
```

**Ожидается:**
```
✅ App exported: function
```

**НЕ должно быть:**
```
🚀 NearPulse API запущен на http://localhost:3001
```

### 2. Тест локального API

```bash
npm run api
# Должен запуститься сервер на :3001

# В другом терминале:
curl http://localhost:3001/api/health
curl http://localhost:3001/api/balance/leninjiv23.tg
```

### 3. Тест с Vercel Dev

```bash
vercel dev
# Откроется на http://localhost:3000

# Проверьте:
# - http://localhost:3000/api/health
# - http://localhost:3000/api/balance/leninjiv23.tg
# - http://localhost:3000/ (frontend)
```

---

## Частые проблемы на Vercel

### Ошибка: "Cannot find module '../src/api'"

**Причина:** api/index.js не может найти src/api.js

**Решение:** Убедитесь что файлы на месте:
```bash
ls src/api.js      # Должен существовать
ls api/index.js    # Должен существовать
```

### Ошибка: "Function exceeded timeout"

**Причина:** NEAR API запросы слишком долгие

**Решение:** Увеличьте timeout в vercel.json:
```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 30
    }
  }
}
```

### Ошибка: "404 Not Found" для /api/health

**Причина:** Неправильные rewrites

**Решение:** Проверьте что destination правильный:
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/index" }
  ]
}
```

### JSON parse error в frontend

**Причина:** API возвращает HTML ошибку вместо JSON

**Решение:** 
1. Проверьте Vercel Functions logs
2. Добавьте try-catch в API endpoints
3. Проверьте что все dependencies установлены

---

## Отладка на Vercel

### 1. Проверьте логи

```bash
vercel logs
# или
vercel logs --follow
```

### 2. Проверьте deployment

```bash
vercel inspect <deployment-url>
```

### 3. Проверьте переменные окружения

```bash
vercel env ls
```

Должны быть:
- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_API_KEY`
- `PIKESPEAK_API_KEY`

### 4. Проверьте функции в Dashboard

Vercel Dashboard → Project → Functions

Должна быть функция: `api/index.js`

---

## Тест production API

После деплоя:

```bash
# Health check
curl https://near-pulse.vercel.app/api/health

# Ожидается:
# {
#   "status": "ok",
#   "service": "NearPulse API"
# }

# Balance check
curl https://near-pulse.vercel.app/api/balance/leninjiv23.tg

# Ожидается:
# {
#   "address": "leninjiv23.tg",
#   "near": { ... },
#   "hot": { ... }
# }
```

---

## Если API не работает на Vercel

### Вариант 1: Проверьте что dependencies установлены

Vercel должен установить:
- express
- cors
- axios
- dotenv

### Вариант 2: Проверьте console.log в Vercel Logs

```bash
vercel logs --follow
```

Должны увидеть:
```
[API] GET /api/health
[API] Запрос баланса для leninjiv23.tg
```

### Вариант 3: Добавьте более подробное логирование

В `api/index.js`:
```javascript
console.log('[Vercel] Loading api/index.js');
const app = require('../src/api');
console.log('[Vercel] App loaded successfully');
module.exports = app;
```

---

## ✅ Чеклист перед коммитом

- [ ] `npm run api` работает локально
- [ ] `curl http://localhost:3001/api/health` возвращает JSON
- [ ] `node -e "require('./api/index')"` НЕ запускает сервер
- [ ] `vercel dev` работает без ошибок
- [ ] Frontend может получить данные с API

Если все пункты ✅ - можно деплоить!
