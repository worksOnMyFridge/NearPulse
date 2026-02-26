# NearPulse 🔥

**Beautiful Transaction Intelligence for NEAR Protocol**

> Персональный аналитик NEAR-кошелька: понятная аналитика транзакций, NFT галерея, AI-советник и мониторинг HOT Protocol — всё в одном Telegram Mini App.

![NearPulse Banner](https://img.shields.io/badge/NEAR-Protocol-black?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTYgMThMMTggNk02IDZsMTIgMTIiLz48L3N2Zz4=)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue?style=for-the-badge&logo=telegram)](https://t.me/YourBot)
[![Live Demo](https://img.shields.io/badge/Demo-Netlify-00C7B7?style=for-the-badge&logo=netlify)](https://nearpulseapp.netlify.app)

---

## ✨ Возможности

| Фича | Описание |
|---|---|
| 💰 **Баланс** | NEAR, стейкинг, HOT токены с ценами в USD |
| 📊 **Аналитика** | Gas расходы, активность по дням, топ протоколы |
| 🤖 **AI Аналитик** | Персональные инсайты на базе Claude AI |
| 🖼️ **NFT Галерея** | 300+ NFT без тайм-аутов, ленивая загрузка |
| 📜 **Транзакции** | Умная группировка: swap, bridge, claim, transfer |
| 🔔 **Уведомления** | HOT claim напоминания за 15 минут |

---

## 🏗️ Архитектура

```
Telegram Bot (Railway)          React Webapp (Netlify)
      │                                │
      └──────────┐          ┌──────────┘
                 ▼          ▼
            Flask API (Render)
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
NearBlocks    FastNEAR    Intear Prices
(txns/NFT)  (contracts)  (token prices)
                 │
            Claude AI API
```

---

## 🚀 Быстрый старт

### Требования
- Node.js 18+
- Python 3.10+

### Telegram Bot
```bash
cd src
npm install
cp ../.env.example .env
# Заполни .env
npm start
```

### Flask API
```bash
pip install -r requirements.txt
cp .env.example .env
python api.py
```

### React Webapp
```bash
cd webapp
npm install
cp .env.example .env.local
# VITE_API_URL=http://localhost:8080
npm run dev
```

---

## ⚙️ Переменные окружения

**Telegram Bot (`.env` в корне):**
```env
TELEGRAM_BOT_TOKEN=    # @BotFather
WEBAPP_URL=            # URL задеплоенного webapp
```

**Flask API (`.env` в корне):**
```env
NEARBLOCKS_API_KEY=    # api.nearblocks.io (бесплатно)
ANTHROPIC_API_KEY=     # console.anthropic.com (для AI)
UPSTASH_REDIS_URL=     # upstash.com (опционально, кэш)
```

**React Webapp (`webapp/.env.local`):**
```env
VITE_API_URL=          # URL Flask API
```

---

## 📦 Деплой

| Сервис | Платформа | Команда запуска |
|---|---|---|
| Telegram Bot | Railway | `node src/index.js` |
| Flask API | Render | `python api.py` |
| React Webapp | Netlify | `cd webapp && npm run build` |

---

## 🛠️ Стек технологий

**Backend:** Python · Flask · Flask-CORS · Redis  
**Bot:** Node.js · Telegraf · SQLite  
**Frontend:** React · Vite · Tailwind CSS  
**APIs:** NearBlocks · FastNEAR · Intear · CoinGecko · Claude AI  

---

## 📄 Лицензия

MIT © 2026 NearPulse
