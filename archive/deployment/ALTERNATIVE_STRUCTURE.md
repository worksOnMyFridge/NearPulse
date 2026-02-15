# 🔄 АЛЬТЕРНАТИВНЫЙ ПОДХОД - Разделение проектов

## 🎯 ПРОБЛЕМА:

Vercel не видит папку `api/` в монорепозитории. 
Все запросы возвращают HTML вместо JSON.

## ✅ РЕШЕНИЕ: Два варианта

---

## ВАРИАНТ 1: Два отдельных Vercel проекта (ПРОЩЕ)

### Frontend проект на Vercel:
1. Vercel Dashboard → Add New Project
2. Import ваш Git репозиторий
3. **Root Directory:** `webapp`
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Deploy

### API проект на другом сервисе:
**Вариант A: Railway.app (бесплатно)**
1. railway.app → New Project → Deploy from GitHub
2. Выберите ваш репозиторий
3. **Root Directory:** оставьте пустым
4. **Start Command:** `node src/api.js`
5. Deploy
6. Скопируйте URL (например: `https://api-production-xyz.up.railway.app`)

**Вариант B: Render.com (бесплатно)**
1. render.com → New Web Service
2. Connect GitHub репозиторий
3. **Build Command:** `npm install`
4. **Start Command:** `node src/api.js`
5. Deploy

### Обновите webapp для использования внешнего API:

В `webapp/.env`:
```env
VITE_API_URL=https://your-api-url.railway.app
```

В `webapp/src/services/api.js`:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

---

## ВАРИАНТ 2: Только webapp на Vercel, API локально (ДЛЯ РАЗРАБОТКИ)

1. Deploy только `webapp/` на Vercel
2. API запускайте локально: `npm run api`
3. Используйте ngrok для тестов: `ngrok http 3001`

---

## ВАРИАНТ 3: Полностью на одном хостинге

Разверните ВСЁ на Railway/Render:

### Railway:
1. Deploy from GitHub
2. **Start Command:** создайте новый скрипт в `package.json`:
   ```json
   "scripts": {
     "start": "npm run build:webapp && npm run serve"
   }
   ```
3. `build:webapp`: `cd webapp && npm run build`
4. `serve`: Используйте `express.static` в `src/api.js` для отдачи `webapp/dist`

---

## 🎯 МОЯ РЕКОМЕНДАЦИЯ:

**Используйте Вариант 1 с Railway для API**

### Почему:
- ✅ Railway проще для Node.js проектов
- ✅ Бесплатный план достаточен
- ✅ Автоматический деплой из Git
- ✅ Не нужно возиться с Vercel serverless ограничениями

### Шаги:

1. **Зарегистрируйтесь на Railway.app**
2. **New Project → Deploy from GitHub**
3. **Select Repository:** ваш near-analytics-bot
4. **Configure:**
   - Start Command: `node src/api.js`
   - Root Directory: оставьте пустым
5. **Deploy!**
6. **Скопируйте URL** (например: `https://near-analytics-bot-production.up.railway.app`)
7. **Обновите `webapp/.env`:**
   ```env
   VITE_API_URL=https://near-analytics-bot-production.up.railway.app
   ```
8. **Заново задеплойте webapp на Vercel**

---

## 📊 СРАВНЕНИЕ:

| Вариант | Сложность | Стоимость | Плюсы |
|---------|-----------|-----------|-------|
| Railway + Vercel | ⭐⭐ | $0 | Просто, работает сразу |
| Render + Vercel | ⭐⭐ | $0 | Просто, работает сразу |
| Всё на Railway | ⭐⭐⭐ | $0 | Всё в одном месте |
| Vercel monorepo | ⭐⭐⭐⭐⭐ | $0 | Не работает! |

---

## 🚀 БЫСТРЫЙ СТАРТ (Railway):

1. Перейдите на https://railway.app
2. Sign up with GitHub
3. New Project → Deploy from GitHub repo
4. Выберите `near-analytics-bot`
5. Дождитесь деплоя
6. Settings → Environment → Add Variables:
   - `BOT_TOKEN`: ваш токен
   - `GEMINI_API_KEY`: ваш ключ
   - `PORT`: 3001
7. Скопируйте URL из Deployments
8. Обновите `webapp/.env.production`:
   ```env
   VITE_API_URL=https://ваш-railway-url.railway.app
   ```
9. Redeploy webapp на Vercel

ГОТОВО! 🎉

---

## 💡 ПОЧЕМУ VERCEL НЕ РАБОТАЕТ:

Vercel serverless functions имеют ограничения:
- Максимум 10s execution (для бесплатного плана)
- Холодный старт
- Проблемы с монорепозиториями
- Express не всегда корректно работает

Railway/Render - это обычные контейнеры, там всё работает как обычный Node.js сервер.

---

Хотите попробовать Railway? Это займёт 5 минут! 🚀
