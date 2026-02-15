# NearPulse REST API

REST API для Telegram Mini App. Предоставляет данные о балансах, транзакциях и статистике NEAR аккаунтов.

## Установка и запуск

### 1. Установите зависимости

```bash
npm install
```

### 2. Добавьте переменную окружения в `.env`

```env
API_PORT=3001  # Порт для API (по умолчанию 3001)
```

### 3. Запустите API сервер

**Продакшн:**
```bash
npm run api
```

**Разработка (с авто-перезагрузкой):**
```bash
npm run api:dev
```

API будет доступен на `http://localhost:3001`

## Endpoints

### GET /api/health
Проверка работоспособности API

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "service": "NearPulse API"
}
```

### GET /api/balance/:address
Получить полный баланс аккаунта

**Параметры:**
- `address` - NEAR адрес (например, `vlad.near`)

**Response:**
```json
{
  "address": "vlad.near",
  "timestamp": 1234567890,
  "near": {
    "available": 125.5,
    "staked": 50.0,
    "total": 175.5,
    "price": 1.07,
    "usdValue": 187.79
  },
  "hot": {
    "amount": 12345.67
  },
  "tokens": {
    "major": [
      {
        "name": "Wrapped NEAR",
        "symbol": "wNEAR",
        "contract": "wrap.near",
        "amount": 10.5,
        "price": 1.07,
        "usdValue": 11.24,
        "decimals": 24
      }
    ],
    "filtered": [],
    "hidden": []
  },
  "totalValue": {
    "near": 175.5,
    "usd": 187.79
  }
}
```

## CORS

API настроен на работу с фронтендом:
- Production: `https://nearpulse.vercel.app` (из `WEBAPP_URL`)
- Development: `http://localhost:5173` (Vite dev server)

## Запуск бота и API одновременно

**Терминал 1 - Telegram Bot:**
```bash
npm start
```

**Терминал 2 - REST API:**
```bash
npm run api
```

## Тестирование

### Через браузер
```
http://localhost:3001/api/health
http://localhost:3001/api/balance/vlad.near
```

### Через curl
```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/balance/vlad.near
```

## Структура проекта

```
src/
├── index.js           # Telegram bot
├── api.js             # REST API (новый)
├── services/
│   └── nearService.js # Логика работы с NEAR API
└── config/
    └── constants.js   # Конфигурация
```

## Следующие шаги

1. ✅ Базовый API сервер создан
2. ✅ Endpoint `/api/balance/:address` работает
3. ⏳ Добавить endpoints для транзакций и статистики
4. ⏳ Интегрировать с React фронтендом
