<p align="center">
  <img src="https://img.shields.io/badge/NEAR-Protocol-00C1DE?style=for-the-badge&logo=near&logoColor=white" />
  <img src="https://img.shields.io/badge/Telegram-Mini_App-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" />
  <img src="https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

<h1 align="center">NearPulse</h1>
<h3 align="center">Your Intelligence in the NEAR World</h3>
<p align="center"><em>Твой интеллект в мире NEAR</em></p>

<p align="center">
  NearPulse — not just a wallet tracker. It's a personal assistant<br/>
  that makes blockchain clear, beautiful, and safe.
</p>

---

## RU | Что такое NearPulse?

NearPulse превращает хаос блокчейна в понятную картину. Вместо непонятных хешей и таблиц — красивые графики, живые таймеры и галерея твоих NFT. Всё прямо в Telegram.

**Ты не обязан разбираться в блокчейне, чтобы пользоваться им с комфортом.**

## EN | What is NearPulse?

NearPulse turns blockchain chaos into a clear picture. Instead of cryptic hashes and spreadsheets — beautiful charts, live timers, and your NFT gallery. All inside Telegram.

**You don't need to understand blockchain to enjoy using it.**

---

## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
## ............................ Features ............................
## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

### 🔥 HOT Claim Control | Контроль HOT

> *Never lose your coins again.*
> *Никогда больше не теряй свои монеты.*

A live countdown timer that ticks every second. You'll always know exactly when your HOT storage fills up. The bot also sends a reminder 15 minutes before claim time — so you can collect your reward even from the bus.

Живой таймер обратного отсчёта, который тикает каждую секунду. Ты всегда знаешь, когда хранилище HOT заполнится. Бот пришлёт напоминание за 15 минут — забирай награду хоть из автобуса.

---

### 🖼️ Infinite NFT Gallery | Бесконечная Галерея

> *100 or 10,000 NFTs? Doesn't matter. Scroll them like a social feed.*
> *100 или 10 000 NFT? Неважно. Листай их как ленту в соцсетях.*

Your NFTs are organized into collections. Spam and junk are moved to a separate "trash" folder so they don't pollute your gallery. Each NFT shows its image, name, and collection — clean and elegant.

Твои NFT разложены по коллекциям. Спам и мусор автоматически попадают в отдельную "мусорку", чтобы не засорять галерею. Каждый NFT показывает картинку, название и коллекцию — чисто и элегантно.

---

### 📈 Clear Analytics | Понятная Аналитика

> *Where does your gas go? Which apps do you use the most?*
> *На что уходит твой газ? Какие приложения ты используешь чаще всего?*

No complicated tables. Just visual charts that show:
- Your activity by day of the week
- Spending breakdown by category (Gaming, DeFi, Transfers, NFT)
- Top protocols you interact with
- AI-powered insights about your wallet behavior

Никаких сложных таблиц. Только наглядные графики:
- Активность по дням недели
- Траты по категориям (Gaming, DeFi, Переводы, NFT)
- Топ-протоколы, с которыми ты взаимодействуешь
- ИИ-инсайты о поведении твоего кошелька

---

### 🎨 Apple-grade Design | Дизайн уровня Apple

> *An app you'll enjoy using — day and night.*
> *Приложение, которым приятно пользоваться — днём и ночью.*

- **Dark / Light themes** — switches with one tap, follows your device preference
- **Glassmorphism** — frosted glass effects that make the UI feel premium
- **Smooth animations** — every card, every chart, every transition is animated
- **Mobile-first** — designed specifically for Telegram Mini App on your phone

- **Тёмная / Светлая тема** — переключается одним нажатием, подстраивается под устройство
- **Эффект стекла (Glassmorphism)** — матовое стекло, которое делает интерфейс премиальным
- **Плавные анимации** — каждая карточка, каждый график, каждый переход — анимированы
- **Mobile-first** — создано специально для Telegram Mini App на телефоне

---

## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
## ................. Security & Privacy .................
## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

<table>
<tr><td>🔐</td><td><b>No passwords</b> — we never ask for your seed phrase or private keys</td></tr>
<tr><td>👻</td><td><b>Full anonymity</b> — no IP tracking, no personal data collection</td></tr>
<tr><td>👁️</td><td><b>Read-only</b> — we only <i>look</i> at public blockchain data, never sign transactions</td></tr>
<tr><td>🛡️</td><td><b>GDPR-compliant</b> — your data stays yours, always</td></tr>
<tr><td>🌐</td><td><b>Open APIs only</b> — all data comes from public NEAR RPC and block explorers</td></tr>
</table>

> **RU:** Мы фанаты твоей приватности. Никаких паролей, никакого слежения за IP, полная анонимность. Мы только *читаем* публичные данные блокчейна — никогда не подписываем транзакции и не касаемся твоих ключей.

---

## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
## .............. Under the Hood ..................
## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

### Fail-Safe Architecture | Неубиваемая Архитектура

NearPulse is built to survive. Every external API call has:
- **Multi-source fallback** — if CoinGecko is down, we try Intear, then Ref Finance, then Nearblocks
- **Smart caching** — data is cached for 30 seconds to reduce load and speed up response
- **Graceful degradation** — if an API fails, the app still works with available data
- **Rate limit awareness** — automatic throttling to respect API limits

> **RU:** NearPulse построен так, чтобы выживать. Каждый внешний вызов имеет многоуровневый fallback — если один API упал, подхватит другой. Умное кэширование на 30 секунд ускоряет ответы. Приложение работает быстро даже при плохом интернете.

### Tech Stack

| Layer | Technology |
|:------|:-----------|
| Telegram Bot | Node.js, Telegraf |
| Mini App | React, Vite, Tailwind CSS v4 |
| API Server | Python, Flask, Flask-CORS |
| Blockchain | NEAR RPC, Nearblocks, CoinGecko, Intear, Ref Finance |
| AI | Google Gemini 2.0 Flash |
| Hosting | Vercel (webapp), any VPS (bot) |

---

## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
## .................. Quick Start ....................
## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

### As a User | Как Пользователь

**Just open the bot in Telegram and send `/start`. That's it.**

1. Send `/balance yourname.near` — see your full portfolio
2. Send `/app yourname.near` — open the Mini App with charts and gallery
3. Send `/settings` — enable HOT claim reminders

> **RU:** Просто открой бота в Telegram и отправь `/start`. Всё.

### As a Developer | Для Разработчиков

```bash
# Clone and install
git clone https://github.com/worksOnMyFridge/NearPulse.git
cd NearPulse

# Bot setup
npm install
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN (from @BotFather)

# Start the bot
npm run dev

# Webapp setup (separate terminal)
cd webapp
npm install
npm run dev

# API server (separate terminal)
pip install -r requirements.txt
python api.py
```

### Environment Variables

| Variable | Required | Description |
|:---------|:---------|:------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Token from @BotFather |
| `WEBAPP_URL` | No | Vercel deployment URL |
| `GOOGLE_API_KEY` | No | For AI-powered `/pulse` reports |
| `PIKESPEAK_API_KEY` | No | Alternative staking data source |

---

## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
## ................... Bot Commands ...................
## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

| Command | What it does |
|:--------|:-------------|
| `/start` | Welcome message and quick intro |
| `/balance <address>` | Full portfolio: NEAR + staking + HOT + all tokens with USD prices |
| `/transactions <address>` | Last 15 transactions with smart grouping and categorization |
| `/pulse <address>` | AI-generated financial report (Gemini) + 24h balance dynamics |
| `/app <address>` | Open the Mini App with interactive charts and NFT gallery |
| `/settings` | Toggle HOT claim notifications (15 min before claim) |
| `/help` | List of all commands |

---

## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
## ..................... Roadmap ......................
## ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

### Done

- [x] NEAR + HOT + staking balance with USD prices
- [x] Multi-source token pricing (CoinGecko, Intear, Ref Finance, Nearblocks)
- [x] Live HOT claim timer (firespace-based)
- [x] AI-powered `/pulse` reports (Gemini 2.0 Flash)
- [x] Push notifications 15 min before HOT claim
- [x] Transaction history with smart grouping
- [x] Telegram Mini App with Glassmorphism UI
- [x] Dark / Light theme toggle
- [x] NFT Gallery with collection sorting
- [x] Python REST API for webapp
- [x] Vercel deployment

### Next

- [ ] Persistent database (SQLite) for settings and balance history
- [ ] Balance charts over time (7d / 30d / all)
- [ ] Spending categorization reports
- [ ] Multi-wallet support
- [ ] Push notifications for large incoming transfers

---

<p align="center">
  <b>Built with love for the NEAR ecosystem</b><br/>
  <em>Создано с любовью для экосистемы NEAR</em>
</p>

<p align="center">
  <a href="https://github.com/worksOnMyFridge/NearPulse">GitHub</a> ·
  <a href="https://near-pulse.vercel.app">Live Demo</a>
</p>

<p align="center">
  <sub>MIT License · 2025</sub>
</p>
