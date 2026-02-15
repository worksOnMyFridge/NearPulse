# 📝 Что изменилось - Подготовка к Vercel

## ✅ Выполненные изменения

### 1. **src/api.js** - Условный запуск сервера ⭐

**Было:**
```javascript
app.listen(PORT, () => {
  console.log('API запущен');
});

module.exports = app;
```

**Стало:**
```javascript
// Запуск сервера ТОЛЬКО если файл запущен напрямую
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('API запущен');
  });
}

// Экспорт для Vercel
module.exports = app;
```

**Зачем:**
- ✅ Локально (`npm run api`) - сервер **запускается**
- ✅ В Vercel (`require()`) - сервер **НЕ запускается**, только экспортируется

### 2. **api/index.js** - Упрощён ⭐

**Было:** 150+ строк дублированного кода

**Стало:**
```javascript
// Просто реэкспортирует app
const app = require('../src/api');
module.exports = app;
```

**Зачем:**
- ✅ Нет дублирования кода
- ✅ Легче поддерживать
- ✅ Один источник истины

### 3. **vercel.json** - Конфигурация создана ⭐

```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.js", "use": "@vercel/node" },
    { "src": "webapp/package.json", "use": "@vercel/static-build" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/index.js" },
    { "src": "/(.*)", "dest": "/webapp/$1" }
  ]
}
```

**Зачем:**
- ✅ Vercel знает как собирать проект
- ✅ Правильная маршрутизация API и frontend

### 4. **webapp/src/services/api.js** - Умное определение URL ⭐

**Было:**
```javascript
const API_BASE_URL = 'http://localhost:3001';
```

**Стало:**
```javascript
const API_BASE_URL = import.meta.env.PROD 
  ? '' // Production: тот же домен
  : 'http://localhost:3001'; // Development
```

**Зачем:**
- ✅ В production нет CORS проблем (тот же домен)
- ✅ В development работает с localhost

### 5. **CORS** - Обновлён

Добавлен Vercel URL в разрешённые origins:
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://near-pulse.vercel.app', // ⭐ НОВЫЙ
  process.env.WEBAPP_URL,
];
```

---

## 📁 Структура проекта

```
near-analytics-bot/
├── api/
│   └── index.js           ⭐ Обёртка для Vercel (упрощена)
├── src/
│   ├── api.js             ⭐ Условный запуск (обновлён)
│   └── services/
│       └── nearService.js
├── webapp/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.js     ⭐ Умный URL (обновлён)
│   │   └── ...
│   └── dist/
├── vercel.json            ⭐ НОВЫЙ
├── .gitignore             ⭐ Добавлена .vercel/
└── package.json
```

---

## 🎯 Как работает

### Локальная разработка:

```bash
# Терминал 1: API
npm run api
# → Запускается src/api.js
# → app.listen() вызывается (require.main === module)
# → Сервер на localhost:3001 ✅

# Терминал 2: Frontend
cd webapp && npm run dev
# → Vite на localhost:5173
# → API URL = http://localhost:3001 ✅

# Терминал 3: Bot (опционально)
npm start
```

### Production (Vercel):

```
https://near-pulse.vercel.app/
├── /                    → React App (webapp/dist)
├── /api/health          → Serverless Function (api/index.js)
└── /api/balance/:addr   → Serverless Function (api/index.js)
                            ↓
                         require('../src/api')
                            ↓
                         src/api.js exports app
                         (НЕ запускает сервер!)
```

**Почему нет CORS:**
- Frontend и API на **одном домене** (`near-pulse.vercel.app`)
- Нет cross-origin запросов!

---

## 🧪 Тестирование

```bash
# 1. Локальный API
npm run api
curl http://localhost:3001/api/health

# 2. Vercel Dev (симуляция production)
vercel dev
curl http://localhost:3000/api/health

# 3. Frontend с реальными данными
cd webapp && npm run dev
# Откройте http://localhost:5173
```

---

## 🚀 Деплой

```bash
# Закоммитьте изменения
git add .
git commit -m "feat: Prepare API for Vercel deployment"
git push origin master

# Vercel автоматически задеплоит!
```

Или через CLI:
```bash
vercel --prod
```

---

## 📚 Документация

Создана полная документация:
- ✅ `VERCEL_DEPLOY.md` - подробное руководство по деплою
- ✅ `DEPLOY_CHECKLIST.md` - быстрая шпаргалка
- ✅ `TEST_API.md` - как тестировать перед деплоем
- ✅ `FULLSTACK_GUIDE.md` - полное руководство
- ✅ `CHANGES_SUMMARY.md` - этот файл

---

## ✨ Итого

**Что изменилось:**
1. ✅ `src/api.js` - условный запуск сервера
2. ✅ `api/index.js` - упрощён до 3 строк
3. ✅ `vercel.json` - конфигурация создана
4. ✅ CORS обновлён для Vercel
5. ✅ Документация создана

**Результат:**
- ✅ Работает локально: `npm run api`
- ✅ Работает в Vercel: serverless functions
- ✅ Нет дублирования кода
- ✅ Нет CORS проблем в production
- ✅ Готово к деплою! 🚀
