# ✅ Чеклист перед деплоем на Vercel

## Быстрая проверка

```bash
# 1. Проверьте что всё работает локально
npm run api          # API на localhost:3001
cd webapp && npm run dev  # Frontend на localhost:5173

# 2. Проверьте структуру
tree -L 2 -I node_modules
```

Должно быть:
```
✅ api/index.js          # Serverless API
✅ vercel.json           # Конфигурация Vercel
✅ webapp/dist/          # Будет создано при build
✅ src/services/         # Общие сервисы
```

## Команды для деплоя

### Через Git (автоматический деплой)

```bash
# 1. Закоммитьте изменения
git add .
git commit -m "feat: Configure Vercel fullstack deploy"
git push origin master

# 2. Зайдите на vercel.com → Import Project
# 3. Готово! Vercel автоматически соберёт и задеплоит
```

### Через Vercel CLI (ручной деплой)

```bash
# 1. Установите Vercel CLI
npm install -g vercel

# 2. Залогиньтесь
vercel login

# 3. Деплой на preview
vercel

# 4. Деплой на production
vercel --prod
```

## Environment Variables для Vercel

Добавьте в Vercel Dashboard → Settings → Environment Variables:

```env
NODE_ENV=production
TELEGRAM_BOT_TOKEN=ваш_токен_здесь
GOOGLE_API_KEY=ваш_ключ_здесь
PIKESPEAK_API_KEY=ваш_ключ_здесь
```

**НЕ добавляйте:**
- ❌ `WEBAPP_URL` (Vercel автоматически определит)
- ❌ `API_PORT` (не нужен для serverless)

## После деплоя проверьте:

```bash
# 1. API Health
curl https://near-pulse.vercel.app/api/health

# 2. API Balance
curl https://near-pulse.vercel.app/api/balance/leninjiv23.tg

# 3. Frontend
# Откройте в браузере:
https://near-pulse.vercel.app/
```

## Структура URL после деплоя:

```
https://near-pulse.vercel.app/
├── /                    → React Frontend (webapp)
├── /api/health          → Serverless API
├── /api/balance/:addr   → Serverless API
└── /api/*               → Все API routes
```

## Если что-то не работает:

### 1. Проверьте логи Vercel:
```bash
vercel logs
# или в Dashboard → Deployments → Functions → Logs
```

### 2. Проверьте Environment Variables:
```bash
vercel env ls
```

### 3. Локальное тестирование с Vercel:
```bash
vercel dev
# Откроется на localhost:3000
```

## Готово! 🚀

После деплоя ваше приложение будет доступно на:
**https://near-pulse.vercel.app/**

Frontend и API работают на одном домене без CORS проблем! ✨
