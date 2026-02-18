# Миграция на Intear API

## Что сделано

### 1. Token Indexer (prices.intear.tech)
- **get_near_price()** — приоритет Intear `get-token-price?token_id=wrap.near`, fallback CoinGecko
- **get_tokens_with_prices()** — Intear как primary источник цен, затем Ref Finance, CoinGecko

### 2. analyze_transaction_group()
- Явные типы: `swap`, `nft`, `bridge`, `transfer`, `token`, `contract`
- Упрощённая логика без костылей
- Поддержка: Swap (Ref/RHEA), NFT, Bridge, Transfer NEAR, Token transfers, Claim (HOT/MOON/Meteor)

### 3. Endpoints
| Endpoint | Источник данных | Примечание |
|----------|-----------------|------------|
| /api/balance | NEAR RPC, Nearblocks, Intear | Цены токенов — Intear |
| /api/transactions | Nearblocks txns | Intear Events — только WebSocket |
| /api/nft | FastNEAR | Intear не имеет REST для NFT по аккаунту |

## Ограничения Intear API

- **Events API** — WebSocket только (realtime), нет REST для исторических транзакций
- **Token Indexer** — цены, метаданные токенов; нет account inventory
- **History Service** — self-hosted, не публичный API

Транзакции и NFT по аккаунту продолжают использовать Nearblocks/FastNEAR.
