# NearPulse — Claude Code Context

## Что это за проект

NearPulse — персональный аналитик NEAR Protocol кошелька. Telegram Mini App с тёмным дизайном в стиле Apple. Цель: показать данные блокчейна так, чтобы понял не-технический пользователь. Это портфолио-проект, не коммерческий.

## Архитектура (3 компонента)

```
NearPulse/
├── src/                        # Telegram Bot (Node.js + Telegraf)
│   ├── index.js                # Точка входа бота
│   ├── services/
│   │   ├── nearService.js      # NEAR API логика для бота
│   │   └── aiService.js        # AI интеграция для бота
│   └── config/
│       ├── constants.js
│       └── database.js
│
├── api.py                      # Python Flask API (деплой: Render)
├── nft_module.py               # NFT модуль (подключается к api.py)
├── requirements.txt
│
└── webapp/                     # React Mini App (деплой: Netlify)
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── Header.jsx          # Хедер с ThemeSwitcher
        │   ├── OverviewScreen.jsx  # Главный экран (баланс, график, инсайты)
        │   ├── TransactionsScreen.jsx
        │   ├── AnalyticsScreen.jsx
        │   ├── GalleryScreenStable.jsx  # NFT галерея (используется)
        │   ├── AiChatWidget.jsx
        │   ├── ThemeSwitcher.jsx
        │   ├── Toast.jsx
        │   └── LoadingSpinner.jsx
        ├── contexts/
        │   └── ThemeContext.jsx    # Единственный источник тем
        ├── hooks/
        │   ├── useTelegram.js      # Telegram WebApp SDK
        │   └── useTheme.js         # Реэкспорт из ThemeContext
        ├── services/
        │   └── api.js              # HTTP клиент к Flask API
        ├── styles/
        │   └── themes.css          # CSS переменные для 3 тем
        └── index.css               # Tailwind + glassmorphism классы
```

## Деплой

| Компонент | Платформа | URL |
|-----------|-----------|-----|
| React webapp | Netlify | https://nearpulseapp.netlify.app |
| Python Flask API | Render | https://nearpulse.onrender.com |
| Telegram Bot | Railway | (отдельный сервис) |

## Тестовый кошелёк

**ВСЕГДА используй `root.near` как дефолтный адрес для тестов.**
Никогда не хардкоди реальные адреса пользователей.
В коде: `const displayAddress = address || 'root.near'`

## Система тем

3 темы: `ocean` (дефолт), `purple`, `emerald`.
- Хранятся в: `webapp/src/contexts/ThemeContext.jsx`
- CSS переменные: `webapp/src/styles/themes.css` и в конце `webapp/src/index.css`
- Применяются через: `data-theme` атрибут на `<html>`
- Переключатель: `ThemeSwitcher.jsx` компонент в хедере

**Правило:** все цвета в компонентах через CSS переменные, НЕ хардкодить hex.
```css
/* ПРАВИЛЬНО */
background: 'var(--accent-gradient)'
color: 'var(--text-primary)'

/* НЕПРАВИЛЬНО */
background: '#6366f1'
color: '#ffffff'
```

## CSS переменные темы

```
--bg-primary          фон страницы
--bg-secondary        фон контентной зоны
--bg-card             фон карточек
--bg-card-hover       hover состояние карточек
--border-primary      граница карточек
--accent-primary      основной акцентный цвет
--accent-secondary    вторичный акцент
--accent-gradient     linear-gradient для карточек и кнопок
--accent-glow         box-shadow glow эффект
--text-primary        основной текст
--text-secondary      вторичный текст
--text-tertiary       слабый текст (подписи, лейблы)
--text-accent         акцентный текст (активные табы)
--color-positive      зелёный (+, рост)
--color-negative      красный (-, падение)
--color-warning       жёлтый (предупреждения)
--color-hot           оранжевый (HOT токен)
--font-main           DM Sans
--font-mono           DM Mono (числа, хеши)
--radius-card         20px
--radius-pill         100px
```

## Источники данных API

| Данные | Источник | Лимиты |
|--------|----------|--------|
| Баланс NEAR | NEAR RPC (rpc.mainnet.near.org) | Нет |
| Транзакции | NearBlocks API v1 | NEARBLOCKS_API_KEY |
| Цены токенов | Intear → Ref Finance → CoinGecko | 60/min |
| HOT таймер | NEAR RPC → game.hot.tg contract | Нет |
| Стейкинги | NearBlocks kitwallet API | NEARBLOCKS_API_KEY |
| NFT коллекции | FastNEAR API | Нет |
| NFT токены | NearBlocks NFT API (pre-indexed) | NEARBLOCKS_API_KEY |
| NEAR цена | Intear → CoinGecko fallback | 60/min |

**КРИТИЧНО для NFT:** Никогда не делать прямые RPC вызовы для 300+ NFT.
Только NearBlocks API с пагинацией (per_page=24). Иначе сервер падает.

## Переменные окружения

### Flask API (Render)
```
NEARBLOCKS_API_KEY=     # Для увеличения лимитов NearBlocks
ANTHROPIC_API_KEY=      # Для AI аналитика
UPSTASH_REDIS_URL=      # Опционально, кеш (иначе in-memory)
PORT=8080
```

### Telegram Bot (Railway)
```
TELEGRAM_BOT_TOKEN=
WEBAPP_URL=https://nearpulseapp.netlify.app
API_URL=https://nearpulse.onrender.com
```

### React Webapp (Netlify)
```
VITE_API_URL=https://nearpulse.onrender.com
```

## Паттерны кода

### Безопасная работа с данными NearBlocks API
NearBlocks может вернуть null или строку вместо dict в `actions_agg`/`outcomes_agg`.
Всегда используй хелпер:
```python
def safe_get(obj, key, default=0):
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default

# Использование:
deposit = safe_get(tx.get("actions_agg"), "deposit", 0)
fee = safe_get(tx.get("outcomes_agg"), "transaction_fee", 0)
```

### Обёртка транзакций в try-except
```python
for tx_hash, tx_group in grouped.items():
    try:
        result = analyze_transaction_group(tx_group, account_id)
        if result:
            analyzed.append(result)
    except Exception as e:
        print(f"[skip tx] {tx_hash}: {e}")
        continue
```

### Кеш на стороне API
```python
CACHE_TTL = 300  # 5 минут для балансов и транзакций
NFT_CACHE_TTL = 600  # 10 минут для NFT
```

### React компоненты — стиль
Используем inline styles с CSS переменными, НЕ Tailwind классы для тематизации:
```jsx
<div style={{
  background: 'var(--bg-card)',
  border: '1px solid var(--border-primary)',
  borderRadius: 'var(--radius-card)',
  padding: 16,
  backdropFilter: 'blur(10px)',
}}>
```

Tailwind используется только для layout: `flex`, `gap-*`, `w-full`, `space-y-*`.

## Известные проблемы (нужно починить)

1. **500 ошибка на /api/transactions и /api/stats** — нужно обернуть цикл обработки транзакций в try-except в двух местах в `api.py`

2. **GalleryScreen.jsx** — старый файл, не используется. Используется `GalleryScreenStable.jsx`. Старый можно удалить.

3. **mockData.js** — заглушка, больше не используется, можно удалить.

4. **`__pycache__/`** — должен быть в `.gitignore`

## Что в планах (roadmap)

### Сейчас (активно)
- Починить 500 ошибку транзакций
- Интегрировать DexScreener API для страницы Рынка
- Переделать AnalyticsScreen под новую тему

### v1.5
- Страница Рынок с топ NEAR токенами (DexScreener)
- P&L по свапам
- Мульти-кошелёк с именами (localStorage)

### v2.0
- Шаринг портфолио как карточка
- Ачивки
