# 🔧 Исправление проблем с Vercel Deploy

## Проблема: JSON ошибка + не деплоится

### Возможные причины:

1. ❌ Vercel не видит новый коммит
2. ❌ Ошибка в vercel.json (невалидный JSON)
3. ❌ API не может найти зависимости
4. ❌ Неправильная структура для serverless functions

---

## ✅ Решение пошагово:

### Шаг 1: Проверьте что изменения закоммичены

В терминале Git Bash или CMD (не PowerShell):

```bash
git status
```

Если есть незакоммиченные файлы:

```bash
git add .
git commit -m "fix: Configure API for Vercel serverless functions"
git push origin master
```

### Шаг 2: Проверьте vercel.json на валидность

Откройте `vercel.json` и проверьте что он валидный JSON:

**Текущее содержимое должно быть:**
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

### Шаг 3: Проверьте структуру файлов

**Должны существовать:**
```
✅ api/index.js          # Serverless function
✅ src/api.js            # Express app
✅ src/services/nearService.js
✅ webapp/package.json
✅ vercel.json
✅ package.json (в корне)
```

### Шаг 4: Проверьте что package.json содержит зависимости

В корневом `package.json` должно быть:
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  }
}
```

---

## 🔍 Альтернативная конфигурация Vercel

Если текущая не работает, попробуйте эту (более явную):

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "webapp/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/webapp/dist/$1"
    }
  ]
}
```

---

## 🛠️ Проверка на Vercel Dashboard

1. Зайдите на https://vercel.com
2. Откройте проект **NearPulse**
3. **Deployments** → выберите последний деплой
4. Проверьте:
   - ✅ Build Logs - есть ли ошибки при сборке?
   - ✅ Functions - создалась ли функция `api/index.js`?
   - ✅ Runtime Logs - какие ошибки в логах?

### Частые ошибки в Build Logs:

**"Cannot find module 'express'"**
→ Добавьте в корневой package.json: `"express": "^4.18.2"`

**"Error: Cannot find module '../src/api'"**
→ Проверьте что `src/api.js` существует и закоммичен

**"JSON parse error"**
→ API возвращает HTML ошибку вместо JSON
→ Проверьте Runtime Logs функции

---

## 📝 Правильный порядок файлов

### api/index.js должен быть:
```javascript
const app = require('../src/api');
module.exports = app;
module.exports.default = app;
```

### src/api.js должен содержать:
```javascript
// Роуты с ДВОЙНЫМИ путями
app.get(['/api/health', '/health'], (req, res) => { ... });
app.get(['/api/balance/:address', '/balance/:address'], (req, res) => { ... });

// Условный запуск
if (require.main === module) {
  app.listen(PORT, () => { ... });
}

module.exports = app;
```

---

## 🚀 Принудительный редеплой

Если Vercel не видит изменения:

### Способ 1: Через Dashboard
1. Vercel Dashboard → Project → Deployments
2. Нажмите на три точки → **Redeploy**
3. Выберите **Use existing Build Cache: No**

### Способ 2: Через CLI
```bash
vercel --force --prod
```

### Способ 3: Пустой коммит
```bash
git commit --allow-empty -m "chore: trigger Vercel redeploy"
git push origin master
```

---

## 🧪 Тест перед деплоем

**Вручную проверьте что файлы на месте:**

1. Откройте `api/index.js` - должен быть 3 строки кода
2. Откройте `src/api.js` - должен экспортировать app
3. Откройте `vercel.json` - должен быть валидный JSON
4. Проверьте что `package.json` содержит express и cors

**Если всё на месте - закоммитьте и пушьте!**

---

## 📊 Что проверить в Vercel Logs

После деплоя откройте Runtime Logs функции `api/index`:

**Хорошие логи:**
```
[API] GET /health
[API] Full URL: https://near-pulse.vercel.app/health
✅ RPC подтверждает для leninjiv23.tg: 13.12 NEAR
```

**Плохие логи:**
```
Error: Cannot find module '../src/api'
Error: express is not defined
SyntaxError: Unexpected token in JSON
```

Покажите мне логи если увидите ошибки!

---

## ⚡ Быстрое решение

Если ничего не помогает, используйте **простейшую конфигурацию**:

**Создайте отдельный standalone API файл без зависимостей:**

```javascript
// api/balance.js
module.exports = async (req, res) => {
  res.json({ status: 'ok', message: 'Simple test' });
};
```

И обновите `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/api/balance", "destination": "/api/balance" }
  ]
}
```

Если это заработает - проблема в импортах. Если нет - проблема в Vercel конфигурации.

---

## 📱 Свяжитесь со мной

Покажите мне:
1. Screenshot ошибки в браузере (F12 → Console)
2. Build Logs из Vercel Dashboard
3. Runtime Logs из Vercel Functions

И я точно найду проблему! 🔍
