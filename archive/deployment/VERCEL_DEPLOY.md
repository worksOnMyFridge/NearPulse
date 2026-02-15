# 🚀 Деплой на Vercel - Полное руководство

Fullstack приложение (React Frontend + Node.js API) на одном домене.

---

## 📁 Структура проекта для Vercel

```
near-analytics-bot/
├── api/
│   └── index.js           # Serverless API для Vercel ⭐ НОВЫЙ
├── src/
│   ├── index.js           # Telegram Bot (не деплоится)
│   ├── api.js             # API для локальной разработки
│   └── services/
│       └── nearService.js # Общая логика
├── webapp/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.js     # Умное определение API URL ⭐ ОБНОВЛЁН
│   │   └── ...
│   ├── dist/              # Собранный frontend (после build)
│   └── package.json
├── vercel.json            # Конфигурация Vercel ⭐ НОВЫЙ
└── package.json
```

---

## ✅ Что настроено

### 1. `vercel.json` - Конфигурация маршрутизации
- ✅ API endpoints (`/api/*`) → serverless функция `api/index.js`
- ✅ Frontend (`/*`) → статические файлы из `webapp/dist`
- ✅ Автоматическая сборка webapp

### 2. `api/index.js` - Serverless API
- ✅ Express app адаптирован для Vercel
- ✅ CORS настроен для production
- ✅ Поддержка environment variables

### 3. `webapp/src/services/api.js` - Умный API клиент
- ✅ **Production:** использует относительные пути (тот же домен)
- ✅ **Development:** использует `localhost:3001`

---

## 🚢 Деплой на Vercel

### Вариант 1: Через Vercel Dashboard (Рекомендуется)

#### Шаг 1: Подготовка репозитория
```bash
# Закоммитьте все изменения
git add .
git commit -m "feat: Add Vercel configuration for fullstack deploy"
git push origin master
```

#### Шаг 2: Подключите проект на Vercel
1. Зайдите на https://vercel.com
2. Залогиньтесь через GitHub
3. **New Project** → выберите репозиторий `NearPulse`
4. Настройки проекта:

```
Framework Preset: Other
Root Directory: ./
Build Command: cd webapp && npm run build
Output Directory: webapp/dist
Install Command: npm install
```

#### Шаг 3: Добавьте Environment Variables
В настройках проекта → **Environment Variables**:

```env
NODE_ENV=production
TELEGRAM_BOT_TOKEN=ваш_токен
GOOGLE_API_KEY=ваш_ключ
PIKESPEAK_API_KEY=ваш_ключ
```

**Важно:** Не добавляйте `WEBAPP_URL` - Vercel автоматически определит домен!

#### Шаг 4: Deploy
Нажмите **Deploy** и ждите ~2-3 минуты

✅ После деплоя:
- Frontend: `https://near-pulse.vercel.app/`
- API Health: `https://near-pulse.vercel.app/api/health`
- API Balance: `https://near-pulse.vercel.app/api/balance/leninjiv23.tg`

---

### Вариант 2: Через Vercel CLI

```bash
# Установите Vercel CLI (если ещё не установлен)
npm install -g vercel

# Залогиньтесь
vercel login

# Деплой
vercel

# Или сразу в production
vercel --prod
```

---

## 🔍 Проверка работы

### 1. Проверьте API
```
https://near-pulse.vercel.app/api/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "service": "NearPulse API",
  "environment": "vercel"
}
```

### 2. Проверьте баланс
```
https://near-pulse.vercel.app/api/balance/leninjiv23.tg
```

Должен вернуть полный баланс аккаунта.

### 3. Проверьте Frontend
```
https://near-pulse.vercel.app/
```

Должен загрузить React приложение с реальными данными из API.

---

## 🎨 Как это работает

### Production (Vercel):
```
User → https://near-pulse.vercel.app/
  ├── /              → React App (webapp/dist)
  ├── /api/health    → Serverless Function (api/index.js)
  └── /api/balance/* → Serverless Function (api/index.js)
```

Frontend и API на **одном домене** → нет CORS проблем!

### Development (Local):
```
User → localhost:5173 (Frontend)
       → localhost:3001 (API)
```

Два разных порта → CORS настроен в `src/api.js`

---

## 🔧 Локальное тестирование с production конфигом

```bash
# Установите Vercel CLI
npm install -g vercel

# Запустите локальную среду Vercel
vercel dev
```

Откроется на `http://localhost:3000` с точно такой же конфигурацией как на production!

---

## 🐛 Troubleshooting

### Ошибка: "Failed to build"
**Причина:** Зависимости не установлены
**Решение:** Проверьте что в `package.json` есть все зависимости:
```bash
npm install
cd webapp && npm install
```

### Ошибка: "API endpoint not found"
**Причина:** Неправильная маршрутизация в `vercel.json`
**Решение:** Проверьте что `api/index.js` существует и экспортирует app

### Ошибка: "CORS policy"
**Причина:** Origin не в списке разрешённых
**Решение:** В `api/index.js` добавьте ваш домен в `allowedOrigins`

### Frontend загружается, но нет данных
**Причина:** API не отвечает
**Решение:** 
1. Проверьте `/api/health`
2. Посмотрите Vercel Logs: Dashboard → Project → Functions
3. Проверьте Environment Variables

---

## 📊 Логи и мониторинг

### Просмотр логов Vercel:
1. Dashboard → ваш проект
2. **Deployments** → выберите деплой
3. **Functions** → выберите функцию → **Logs**

### Логи в реальном времени:
```bash
vercel logs
```

---

## 🔄 Автоматический деплой

После первого деплоя Vercel автоматически:
- ✅ Отслеживает коммиты в репозитории
- ✅ Деплоит каждый push в `master`
- ✅ Создаёт preview деплой для PR

---

## 📝 Следующие шаги

- [ ] Добавить custom domain (если нужно)
- [ ] Настроить production environment variables
- [ ] Добавить мониторинг ошибок (Sentry)
- [ ] Настроить CDN для статики

---

## ✨ Готово!

Теперь у вас fullstack NEAR Analytics приложение на Vercel! 🎉

- Frontend: React + Vite
- API: Node.js Serverless Functions
- Один домен: без CORS проблем
- Автоматический деплой при push
