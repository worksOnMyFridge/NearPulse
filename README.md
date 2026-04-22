# NearPulse 🔥

**Beautiful Transaction Intelligence for NEAR Protocol**

> Your personal NEAR wallet analyst — clear transaction analytics, NFT gallery, AI advisor, and HOT Protocol monitoring. All in one Telegram Mini App.

![NEAR Protocol](https://img.shields.io/badge/NEAR-Protocol-black?style=for-the-badge)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-blue?style=for-the-badge&logo=telegram)](https://t.me/YourBot)
[![Live Demo](https://img.shields.io/badge/Demo-Netlify-00C7B7?style=for-the-badge&logo=netlify)](https://nearpulseapp.netlify.app)

---

## ✨ Features

| Feature | Description |
|---|---|
| 💰 **Balance** | NEAR, staking, HOT tokens with live USD prices |
| 📊 **Analytics** | Gas spending, daily activity, top protocols |
| 🤖 **AI Analyst** | Personalized insights powered by Claude AI |
| 🖼️ **NFT Gallery** | 300+ NFTs with lazy loading, no timeouts |
| 📜 **Transactions** | Smart grouping: swap, bridge, claim, transfer |
| 🔔 **Notifications** | HOT claim reminders 15 minutes before ready |

---

## 🏗️ Architecture

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

## 🚀 Quick Start

### Requirements
- Node.js 18+
- Python 3.10+

### Telegram Bot
```bash
cd src
npm install
cp ../.env.example .env
# Fill in .env
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
# Set VITE_API_URL=http://localhost:8080
npm run dev
```

---

## ⚙️ Environment Variables

**Telegram Bot & API (`.env` in root):**
```env
TELEGRAM_BOT_TOKEN=    # from @BotFather
NEARBLOCKS_API_KEY=    # api.nearblocks.io (free)
ANTHROPIC_API_KEY=     # console.anthropic.com (for AI)
WEBAPP_URL=            # deployed webapp URL
UPSTASH_REDIS_URL=     # upstash.com (optional, caching)
```

**React Webapp (`webapp/.env.local`):**
```env
VITE_API_URL=          # Flask API URL
```

---

## 📦 Deployment

| Service | Platform | Start Command |
|---|---|---|
| Telegram Bot | Railway | `node src/index.js` |
| Flask API | Render | `python api.py` |
| React Webapp | Netlify | `cd webapp && npm run build` |

---

## 🛠️ Tech Stack

**Backend:** Python · Flask · Flask-CORS · Redis  
**Bot:** Node.js · Telegraf · SQLite  
**Frontend:** React · Vite · Tailwind CSS  
**APIs:** NearBlocks · FastNEAR · Intear · CoinGecko · Claude AI

---

## 📄 License

MIT © 2026 NearPulse
