const axios = require('axios');
const { NEARBLOCKS_API_URL, PIKESPEAK_API_URL, INTEAR_API_URL, API_TIMEOUT } = require('../config/constants');

const PIKESPEAK_API_KEY = process.env.PIKESPEAK_API_KEY;

const YOCTO_NEAR = 1e24;
const NEAR_RPC_URL = 'https://rpc.mainnet.near.org';
const HOT_CONTRACT = 'game.hot.tg';

// Кэш для цены NEAR (обновляется раз в 5 минут)
let nearPriceCache = { price: null, timestamp: 0 };
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Кэш для цен токенов CoinGecko (избегаем 429)
let tokenPricesCache = { prices: {}, timestamp: 0 };
const TOKEN_PRICES_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// firespace (уровень хранилища 0-5) -> часы до заполнения
// firespace 5 = 12ч (макс. средний уровень), firespace 6+ = 24ч
const FIRESPACE_HOURS = {
  0: 2,
  1: 3,
  2: 4,
  3: 6,
  4: 12,
  5: 12,
  6: 24,
};

const STORAGE_LEVEL_HOURS = {
  0: 2,
  1: 3,
  2: 4,
  3: 6,
  4: 12,
  5: 24,
};

async function getBalance(address) {
  try {
    const response = await axios.post('https://rpc.mainnet.near.org', {
      jsonrpc: '2.0',
      id: 'dontcare',
      method: 'query',
      params: {
        request_type: 'view_account',
        finality: 'final',
        account_id: address,
      },
    }, { timeout: API_TIMEOUT });

    if (response.data.error) {
      throw new Error('Аккаунт не найден');
    }

    const amount = response.data.result.amount;
    const near = Number(amount) / YOCTO_NEAR;

    console.log(`✨ RPC подтверждает для ${address}: ${near.toFixed(2)} NEAR`);

    return { address, near, raw: amount };
  } catch (error) {
    console.error('Ошибка RPC:', error.message);
    return { address, near: 0, raw: '0' };
  }
}

async function getTokenBalance(address, tokenId = 'game.hot.tg') {
  try {
    const url = `${NEARBLOCKS_API_URL}/account/${address}/inventory`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    const token = response.data.inventory.fts.find((t) => t.contract === tokenId);
    return token ? parseFloat(token.amount) / 1e6 : 0;
  } catch (error) {
    console.error('getTokenBalance error:', error.message);
    throw new Error('Ошибка получения HOT баланса');
  }
}

/**
 * Получает список всех токенов (FT) на балансе аккаунта.
 * @param {string} address - NEAR адрес
 * @returns {Promise<Array>} Массив токенов с названием, контрактом и количеством
 */
async function getAllTokens(address) {
  try {
    const url = `${NEARBLOCKS_API_URL}/account/${address}/inventory`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    
    const tokens = response.data.inventory?.fts ?? [];
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[getAllTokens] Найдено ${tokens.length} токенов`);
      // Логируем первый токен для отладки структуры данных
      if (tokens.length > 0) {
        console.log('[getAllTokens] Пример токена:', JSON.stringify(tokens[0], null, 2));
      }
    }
    
    // Форматируем токены для удобного отображения
    return tokens.map(token => {
      // Nearblocks API возвращает raw amount БЕЗ decimals
      let rawAmount = token.amount || token.balance || '0';
      
      // Преобразуем строку в число
      let amount = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;
      
      // Получаем decimals: ПРИОРИТЕТ для проверенных токенов, затем ft_meta
      // (API иногда возвращает неправильные decimals, например BRRR = 18 вместо 9)
      let decimals = TOKEN_DECIMALS_MAP[token.contract] || 
                     TOKEN_DECIMALS_MAP[token.contract.toLowerCase()] ||
                     token.ft_meta?.decimals || 
                     token.decimals;
      
      // Если decimals ВООБЩЕ не найдены, применяем эвристику:
      if (!decimals) {
        // Bridged токены (содержат .factory.bridge.near) обычно 18 decimals
        if (token.contract.includes('.factory.bridge.near')) {
          decimals = 18;
        }
        // Токены из meme-cooking обычно имеют 18 decimals
        else if (token.contract.includes('meme-cooking.near')) {
          decimals = 18;
        }
        // Токены с .tkn.near обычно 18 decimals
        else if (token.contract.includes('.tkn.near')) {
          decimals = 18;
        }
        // Токены с .near обычно 18-24 decimals, если число очень большое
        else if (token.contract.includes('.near') && amount > 1e20) {
          decimals = 18;
        }
        // Если число огромное (> 10^15), скорее всего нужны decimals
        else if (amount > 1e15) {
          decimals = 18; // По умолчанию 18 для больших чисел
        }
        else {
          decimals = 0;
        }
      }
      
      // Получаем символ токена (приоритет: symbol -> ft_meta.symbol -> первая часть контракта)
      let symbol = token.symbol || token.ft_meta?.symbol;
      if (!symbol) {
        // Если нет символа, берем первую часть контракта до точки
        const parts = token.contract.split('.');
        // Для длинных хешей (типа ERC20 bridged) берем начало и конец
        if (parts[0].length > 20 && !parts[0].includes('-')) {
          symbol = parts[0].substring(0, 6).toUpperCase() + '...' + parts[0].substring(parts[0].length - 4).toUpperCase();
        } else {
          symbol = parts[0].length > 15 ? parts[0].substring(0, 10).toUpperCase() : parts[0].toUpperCase();
        }
      }
      
      // Применяем decimals
      let normalized = amount;
      if (decimals > 0 && amount > 0) {
        normalized = amount / Math.pow(10, decimals);
      }
      
      // Nearblocks API может возвращать цену токена
      const nearblocks_price = token.price || token.ft_meta?.price || 0;
      
      // Логируем токены для отладки (показываем только первые 10)
      if (process.env.NODE_ENV !== 'production') {
        const tokenIndex = tokens.indexOf(token);
        if (tokenIndex < 10 || nearblocks_price > 0) {
          console.log(`[Token ${tokenIndex+1}] ${symbol}: raw=${amount}, decimals=${decimals}, normalized=${normalized.toFixed(6)}, nb_price=$${nearblocks_price}`);
        }
      }
      
      const result = {
        name: token.name || token.ft_meta?.name || symbol,
        symbol: symbol,
        contract: token.contract,
        amount: normalized,
        decimals: decimals,
        icon: token.icon || token.ft_meta?.icon || null,
        nearblocks_price: nearblocks_price, // Цена из Nearblocks (если есть)
      };
      
      return result;
    }).filter(t => t.amount > 0); // Показываем только токены с балансом > 0
  } catch (error) {
    console.error('getAllTokens error:', error.message);
    return []; // Возвращаем пустой массив при ошибке
  }
}

/**
 * Получает токены с ценами и разделяет их на категории.
 * @param {string} address - NEAR адрес
 * @param {number} minUsdValue - Минимальная стоимость в USD для отображения (по умолчанию $1)
 * @returns {Promise<Object>} Объект с категориями токенов: { major, filtered, hidden }
 */
async function getTokensWithPrices(address, minUsdValue = 1) {
  try {
    const tokens = await getAllTokens(address);
    
    // Исключаем HOT токен (он отображается отдельно)
    const filteredTokens = tokens.filter(t => t.contract.toLowerCase() !== 'game.hot.tg');
    
    if (filteredTokens.length === 0) {
      return { major: [], filtered: [], hidden: [] };
    }

    // Получаем цены для всех токенов из разных источников
    const contracts = filteredTokens.map(t => t.contract);
    // Pikespeak API отключен из-за rate limit (HTTP 429)
    const [coingeckoPrices, refPrices, intearPrices] = await Promise.all([
      getTokenPrices(contracts),
      getRefFinancePrices(contracts),
      getIntearPrices(contracts), // Intear = RHEA Finance + все токены NEAR
      // getPikespeakPrices(contracts), // ОТКЛЮЧЕН
    ]);
    const pikespeakPrices = {}; // Пустой объект для совместимости

    // Добавляем цены и считаем стоимость в USD
    const tokensWithPrices = filteredTokens.map(token => {
      // Приоритет цен: CoinGecko -> Intear (RHEA) -> Ref Finance -> Nearblocks API -> Manual
      const coingeckoPrice = coingeckoPrices[token.contract] || coingeckoPrices[token.contract.toLowerCase()] || 0;
      const intearPrice = intearPrices[token.contract] || intearPrices[token.contract.toLowerCase()] || 0;
      const refPrice = refPrices[token.contract] || refPrices[token.contract.toLowerCase()] || 0;
      const pikespeakPrice = pikespeakPrices[token.contract] || pikespeakPrices[token.contract.toLowerCase()] || 0;
      const nearblocksPrice = token.nearblocks_price || 0;
      const manualPrice = MANUAL_TOKEN_PRICES[token.contract] || MANUAL_TOKEN_PRICES[token.contract.toLowerCase()] || 0;
      
      let price = 0;
      let priceSource = 'none';
      
      if (coingeckoPrice > 0) {
        price = coingeckoPrice;
        priceSource = 'coingecko';
      } else if (intearPrice > 0) {
        price = intearPrice;
        priceSource = 'intear'; // RHEA Finance
      } else if (refPrice > 0) {
        price = refPrice;
        priceSource = 'ref';
      } else if (pikespeakPrice > 0) {
        price = pikespeakPrice;
        priceSource = 'pikespeak';
      } else if (nearblocksPrice > 0) {
        price = nearblocksPrice;
        priceSource = 'nearblocks';
      } else if (manualPrice > 0) {
        price = manualPrice;
        priceSource = 'manual';
      }
      
      const usdValue = token.amount * price;
      
      // Проверяем, является ли токен основным (независимо от регистра)
      const isMajor = MAJOR_TOKENS.some(major => 
        major.toLowerCase() === token.contract.toLowerCase()
      );
      
      return {
        ...token,
        price,
        usdValue,
        isMajor,
        priceSource,
      };
    });

    // Разделяем на категории
    // Основные токены показываем если есть цена И стоимость >= $1
    const major = tokensWithPrices
      .filter(t => t.isMajor && t.price > 0 && t.usdValue >= 1)
      .sort((a, b) => b.usdValue - a.usdValue);

    const others = tokensWithPrices.filter(t => !t.isMajor);
    
    // Другие токены показываем если:
    // 1. Есть цена И стоимость >= minUsdValue ИЛИ
    // 2. Нет цены, НО количество в диапазоне 15K-500K (избегаем мусорных мемкоинов с миллиардами)
    const filtered = others
      .filter(t => {
        const hasValidPrice = t.price > 0 && t.usdValue >= minUsdValue;
        const hasReasonableBalance = t.price === 0 && t.amount >= 15000 && t.amount <= 500000;
        return hasValidPrice || hasReasonableBalance;
      })
      .sort((a, b) => {
        // Сортируем: с ценой по стоимости, без цены по количеству
        if (a.price > 0 && b.price > 0) return b.usdValue - a.usdValue;
        if (a.price > 0) return -1;
        if (b.price > 0) return 1;
        return b.amount - a.amount;
      });

    // Скрытые: токены, которые не попали в filtered
    const majorBelowThreshold = tokensWithPrices.filter(t => t.isMajor && (t.price === 0 || t.usdValue < 1));
    const hidden = [
      ...others.filter(t => {
        const hasValidPrice = t.price > 0 && t.usdValue >= minUsdValue;
        const hasReasonableBalance = t.price === 0 && t.amount >= 15000 && t.amount <= 500000;
        return !hasValidPrice && !hasReasonableBalance;
      }),
      ...majorBelowThreshold
    ].sort((a, b) => b.amount - a.amount);

    console.log(`💎 Токены: основные=${major.length}, фильтрованные=${filtered.length}, скрытые=${hidden.length}`);
    
    // Логируем токены без цены, которые показываются (чтобы можно было добавить в MANUAL_TOKEN_PRICES)
    if (process.env.NODE_ENV !== 'production') {
      const noPriceTokens = filtered.filter(t => t.price === 0 && t.amount >= 15000);
      if (noPriceTokens.length > 0) {
        console.log(`\n⚠️  Токены БЕЗ ЦЕНЫ (добавьте в MANUAL_TOKEN_PRICES если знаете цену):`);
        noPriceTokens.forEach(t => {
          console.log(`   '${t.contract}': ???, // ${t.symbol} (${t.amount.toFixed(2)} токенов)`);
        });
      }
    }

    return { major, filtered, hidden };
  } catch (error) {
    console.error('getTokensWithPrices error:', error.message);
    return { major: [], filtered: [], hidden: [] };
  }
}

/**
 * Суммирует стейк из ответа Pikespeak (массив с полями amount/deposit/staked в NEAR или yocto).
 */
function sumStakingFromPikespeak(data) {
  let total = 0;
  const list = Array.isArray(data) ? data : (data?.staking ?? data?.delegations ?? data?.data ?? []);
  if (!Array.isArray(list)) return 0;
  for (const item of list) {
    const raw = item.amount ?? item.deposit ?? item.staked ?? item.balance ?? item.total ?? 0;
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
    if (isNaN(num)) continue;
    if (num > 0 && num < 1e10) total += num;
    else if (num >= 1e10) total += num / YOCTO_NEAR;
  }
  return total;
}

/**
 * Получает сумму застейканных NEAR.
 * 1) Если задан PIKESPEAK_API_KEY — запрос к Pikespeak /staking/staking/{account}
 * 2) Иначе — Nearblocks Kitwallet /kitwallet/staking-deposits/{account}
 */
async function getStakingBalance(address) {
  const encoded = encodeURIComponent(address);

  if (PIKESPEAK_API_KEY) {
    for (const path of ['/staking/staking/', '/staking/probable-staking/']) {
      try {
        const url = `${PIKESPEAK_API_URL}${path}${encoded}`;
        const response = await axios.get(url, {
          timeout: API_TIMEOUT,
          headers: { 'x-api-key': PIKESPEAK_API_KEY },
        });
        const total = sumStakingFromPikespeak(response.data);
        if (total > 0) return total;
      } catch (error) {
        if (path === '/staking/staking/') console.error('getStakingBalance (Pikespeak):', error.message);
      }
    }
  }

  try {
    const url = `${NEARBLOCKS_API_URL}/kitwallet/staking-deposits/${encoded}`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });

    const data = response.data;
    const deposits = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : data?.deposits ?? []);
    let totalStaked = 0;

    for (const item of deposits) {
      const deposit = item.deposit ?? item.amount ?? '0';
      const amount = parseInt(String(deposit), 10);
      if (!isNaN(amount) && amount > 0) {
        totalStaked += amount / YOCTO_NEAR;
      }
    }

    return totalStaked;
  } catch (error) {
    console.error('getStakingBalance (Nearblocks):', error.message);
    return 0;
  }
}

const KNOWN_STORAGE_HOURS = [2, 3, 4, 6, 12, 24];

/**
 * Определяет время до заполнения хранилища в часах.
 * Контракт может возвращать: level 0-5 ИЛИ часы напрямую (2, 3, 4, 6, 12, 24).
 */
function getMaxStorageTimeMs(storageValue) {
  if (storageValue == null || storageValue === '') return 24 * 60 * 60 * 1000;
  const num = typeof storageValue === 'object' && storageValue !== null && 'value' in storageValue
    ? parseInt(storageValue.value, 10)
    : parseInt(storageValue, 10);
  if (isNaN(num)) return 24 * 60 * 60 * 1000;

  if (KNOWN_STORAGE_HOURS.includes(num)) {
    return num * 60 * 60 * 1000;
  }
  if (num >= 1 && num <= 24) {
    return num * 60 * 60 * 1000;
  }
  const hours = STORAGE_LEVEL_HOURS[num] ?? STORAGE_LEVEL_HOURS[5];
  return hours * 60 * 60 * 1000;
}

/**
 * Извлекает время до заполнения (в часах) из ответа get_user.
 * firespace = уровень хранилища (0-5), определяет фактическое время.
 * storage = максимум (24) — не отражает индивидуальные настройки.
 */
function extractStorageHours(data) {
  const firespace = data.firespace;
  if (firespace !== undefined && firespace !== null) {
    const level = parseInt(firespace, 10);
    if (!isNaN(level) && level in FIRESPACE_HOURS) {
      return FIRESPACE_HOURS[level];
    }
  }
  const raw =
    data.storage_hours ??
    data.storage_duration ??
    data.storage_fill_hours ??
    data.claim_interval ??
    data.mining_interval ??
    data.level ??
    data.storage_level ??
    data.storage;
  return raw;
}

async function getHotClaimStatus(address) {
  try {
    const argsBase64 = Buffer.from(
      JSON.stringify({ account_id: address })
    ).toString('base64');

    const response = await axios.post(
      NEAR_RPC_URL,
      {
        jsonrpc: '2.0',
        id: 'dontcare',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: HOT_CONTRACT,
          method_name: 'get_user',
          args_base64: argsBase64,
        },
      },
      { timeout: API_TIMEOUT }
    );

    if (response.data.error) return null;

    const result = response.data.result?.result;
    if (!result || !Array.isArray(result)) return null;

    const jsonStr = Buffer.from(result).toString('utf8');
    const data = JSON.parse(jsonStr);

    const storageRaw = extractStorageHours(data);
    const maxStorageMs = getMaxStorageTimeMs(storageRaw ?? 5);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[HOT get_user] storageRaw:', storageRaw, 'maxStorageHours:', maxStorageMs / (60 * 60 * 1000));
      console.log('[HOT get_user] полный ответ (для отладки):', JSON.stringify(data));
    }

    const lastClaimRaw = data.last_claimed_at ?? data.last_claim ?? data.claimed_at ?? data.updated_at ?? 0;
    const lastClaimMs = lastClaimRaw > 1e15 ? lastClaimRaw / 1e6 : lastClaimRaw;

    const nextClaimAt = lastClaimMs + maxStorageMs;
    const now = Date.now();
    const canClaim = now >= nextClaimAt;

    const diffMs = nextClaimAt - now;
    const hoursUntilClaim = Math.floor(diffMs / (60 * 60 * 1000));
    const minutesUntilClaim = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

    // Форматируем время до клейма
    let timeUntilClaim = '';
    if (canClaim) {
      timeUntilClaim = 'Можно клеймить!';
    } else if (hoursUntilClaim > 0) {
      timeUntilClaim = `${hoursUntilClaim} ч ${minutesUntilClaim} мин`;
    } else {
      timeUntilClaim = `${minutesUntilClaim} мин`;
    }

    return {
      canClaim,
      nextClaimTime: nextClaimAt,
      lastClaimTime: lastClaimMs,
      timeUntilClaim,
      hoursUntilClaim,
      minutesUntilClaim,
    };
  } catch (error) {
    console.error('getHotClaimStatus error:', error.message);
    return null;
  }
}

// Rate limiting: 500ms между вызовами API транзакций
let lastTxApiCall = 0;
const RATE_LIMIT_MS = 500;

async function rateLimitDelay() {
  const now = Date.now();
  const elapsed = now - lastTxApiCall;
  if (lastTxApiCall > 0 && elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastTxApiCall = Date.now();
}

async function getTransactionHistory(address, limit = 100) {
  await rateLimitDelay();
  // ВРЕМЕННО: Возвращаем пустой массив из-за Nearblocks rate limit 429
  console.log(`⚠️ [TX] История транзакций временно отключена (Nearblocks 429)`);
  return [];
}

/**
 * Получает детальную информацию о транзакции с полными логами
 * @param {string} txHash - Hash транзакции
 * @returns {Promise<Object>} Детали транзакции с логами
 */
async function getTransactionDetails(txHash) {
  await rateLimitDelay();
  try {
    const url = `${NEARBLOCKS_API_URL}/txns/${txHash}`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    return response.data?.receipts || [];
  } catch (error) {
    console.error('getTransactionDetails error:', error.message);
    return [];
  }
}

/**
 * Получает актуальный курс NEAR к USD (с кэшированием 5 минут)
 * @returns {Promise<number>} Цена NEAR в USD
 */
async function getNearPrice() {
  // Проверяем кэш
  const now = Date.now();
  if (nearPriceCache.price && (now - nearPriceCache.timestamp) < PRICE_CACHE_TTL) {
    return nearPriceCache.price;
  }
  
  // Пробуем несколько источников цены NEAR
  
  // Источник 1: CoinGecko (бесплатный, но может быть ограничен)
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price';
    const response = await axios.get(url, {
      timeout: 5000,
      params: {
        ids: 'near',
        vs_currencies: 'usd',
      },
    });

    const price = response.data?.near?.usd;
    if (price && typeof price === 'number') {
      // Сохраняем в кэш
      nearPriceCache = { price, timestamp: Date.now() };
      console.log(`💵 Текущий курс NEAR: $${price.toFixed(2)} (CoinGecko, cached 5 min)`);
      return price;
    }
  } catch (error) {
    console.warn('CoinGecko недоступен (rate limited)');
  }

  // Источник 2: Ref Finance (DEX на NEAR, надежный источник)
  try {
    const response = await axios.get('https://indexer.ref.finance/get-token-price', {
      timeout: 5000,
      params: {
        token_id: 'wrap.near',
      },
    });

    const price = parseFloat(response.data?.price);
    if (price && !isNaN(price)) {
      console.log(`💵 Текущий курс NEAR: $${price.toFixed(2)} (Ref Finance)`);
      return price;
    }
  } catch (error) {
    console.warn('Ref Finance недоступен:', error.message);
  }

  // Источник 3: Nearblocks (запасной вариант)
  try {
    const response = await axios.get('https://api.nearblocks.io/v1/stats', {
      timeout: 5000,
    });

    const price = parseFloat(response.data?.stats?.[0]?.near_price);
    if (price && !isNaN(price)) {
      console.log(`💵 Текущий курс NEAR: $${price.toFixed(2)} (Nearblocks)`);
      return price;
    }
  } catch (error) {
    console.warn('Nearblocks недоступен:', error.message);
  }

  // Если все источники недоступны, возвращаем кэш или fallback
  const fallbackPrice = nearPriceCache.price || 1.04;
  console.warn(`⚠️ Все источники недоступны, используем ${nearPriceCache.price ? 'кэш' : 'fallback'}: $${fallbackPrice.toFixed(2)}`);
  return fallbackPrice;
}

// Маппинг контрактов NEAR токенов на decimals
// Nearblocks API не возвращает decimals, поэтому храним их здесь
const TOKEN_DECIMALS_MAP = {
  // Bridged стейблкоины
  'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near': 6, // USDT
  'usdt.tether-token.near': 6, // USDT
  'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near': 6, // USDC
  '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1': 18, // DAI
  
  // NEAR
  'wrap.near': 24, // wNEAR
  
  // DeFi токены
  'token.v2.ref-finance.near': 18, // REF
  'token.burrow.near': 9, // BRRR (исправлено: было 18)
  'meta-pool.near': 24, // META
  'token.skyward.near': 18, // SKYWARD
  'token.pembrock.near': 18, // PEM
  
  // Bridged крипта
  '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near': 8, // wBTC
  '2260fac5e5542a773aa44fbcfedf7c193bc2c599': 8, // wBTC (короткий)
  'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near': 18, // wETH
  'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 18, // ETH (короткий)
  'eth.bridge.near': 18, // ETH bridge
  
  // Экосистема и мемкоины
  'aurora': 18, // AURORA
  'aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near': 18, // AURORA (bridged)
  'token.paras.near': 18, // PARAS
  'game.hot.tg': 6, // HOT
  'jambo-1679.meme-cooking.near': 18, // JAMBO
  'token.jumbo_exchange.near': 18, // JUMBO
  'jumptoken.jumpfinance.near': 18, // JUMP
  
  // Популярные токены
  'harvest-moon.near': 6, // MOON
  'aa-harvest-moon.near': 9, // MOON (AA)
  'token.0xshitzu.near': 18, // SHITZU
  'wbnb.hot.tg': 18, // WBNB
  'pre.meteor-token.near': 9, // MEPT
  'meteor-points.near': 9, // MPTS
  'token.rhealab.near': 9, // RHEA
  'otoken.rhealab.near': 18, // ORHEA
  'xtoken.rhealab.near': 18, // XRHEA
  'lst.rhealab.near': 24, // rNEAR (liquid staking, как NEAR - 24 decimals!)
  'token.lonkingnearbackto2024.near': 18, // LONK
  'd9c2d319cd7e6177336b0a9c93c21cb48d84fb54.factory.bridge.near': 18, // HAPI (bridged)
  'zec.omft.near': 18, // ZEC
  'dd.tg': 18, // DD
  'benthedog.near': 18, // BENDOG
};

// Маппинг контрактов NEAR токенов на CoinGecko ID
const TOKEN_COINGECKO_MAP = {
  // Bridged стейблкоины
  'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near': 'tether', // USDT
  'usdt.tether-token.near': 'tether', // USDT (альтернативный)
  'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near': 'usd-coin', // USDC
  '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1': 'dai', // DAI
  
  // NEAR и wrapped
  'wrap.near': 'near', // wNEAR
  
  // DeFi токены
  'token.v2.ref-finance.near': 'ref-finance', // REF
  'token.burrow.near': 'burrow', // BRRR
  'meta-pool.near': 'meta-pool', // META
  'token.skyward.near': 'skyward-finance', // SKYWARD
  'token.pembrock.near': 'pembrock', // PEM
  
  // Bridged крипта
  '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near': 'wrapped-bitcoin', // wBTC
  'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near': 'ethereum', // wETH (Bridged ETH)
  '2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin', // wBTC (короткий адрес)
  'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'ethereum', // ETH (короткий адрес)
  'eth.bridge.near': 'ethereum', // ETH bridge
  
  // Экосистема
  'aurora': 'aurora-near', // AURORA
  'token.paras.near': 'paras', // PARAS
  'token.jumbo_exchange.near': 'jumbo-exchange', // JUMBO
  'jumptoken.jumpfinance.near': 'jumbo-exchange', // JAMBO/JUMP
};

// Ручной маппинг цен для токенов, которые не найдены в API
// Используется как последний fallback, если токен не найден нигде
const MANUAL_TOKEN_PRICES = {
  // GT теперь находится через Intear API (RHEA Finance)
  // 'gt-1733.meme-cooking.near': 0.0000625,
  
  // Добавьте другие токены по мере необходимости
};

// Основные токены NEAR экосистемы (будут показаны отдельно, если стоимость > $1)
const MAJOR_TOKENS = [
  'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near', // USDT
  'usdt.tether-token.near', // USDT
  'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near', // USDC
  '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1', // DAI
  'wrap.near', // wNEAR
  '2260fac5e5542a773aa44fbcfedf7c193bc2c599.factory.bridge.near', // wBTC
  '2260fac5e5542a773aa44fbcfedf7c193bc2c599', // wBTC (короткий)
  'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.factory.bridge.near', // wETH
  'c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // ETH (короткий)
];

/**
 * Получает цены множества токенов через CoinGecko API.
 * @param {Array<string>} contracts - Массив контрактов токенов
 * @returns {Promise<Object>} Объект с ценами токенов (contract -> price)
 */
async function getTokenPrices(contracts) {
  try {
    // Проверяем кэш
    const now = Date.now();
    if (Object.keys(tokenPricesCache.prices).length > 0 && (now - tokenPricesCache.timestamp) < TOKEN_PRICES_CACHE_TTL) {
      return tokenPricesCache.prices;
    }

    // Собираем уникальные CoinGecko IDs для контрактов
    const contractToGeckoId = new Map();
    const uniqueGeckoIds = new Set();

    contracts.forEach(contract => {
      const geckoId = TOKEN_COINGECKO_MAP[contract.toLowerCase()];
      if (geckoId) {
        contractToGeckoId.set(contract, geckoId);
        uniqueGeckoIds.add(geckoId);
      }
    });

    if (uniqueGeckoIds.size === 0) return {};

    const url = 'https://api.coingecko.com/api/v3/simple/price';
    const response = await axios.get(url, {
      timeout: API_TIMEOUT,
      params: {
        ids: Array.from(uniqueGeckoIds).join(','),
        vs_currencies: 'usd',
      },
    });

    // Создаем маппинг contract -> price
    const prices = {};
    contractToGeckoId.forEach((geckoId, contract) => {
      const price = response.data[geckoId]?.usd;
      if (price && typeof price === 'number') {
        prices[contract] = price;
        prices[contract.toLowerCase()] = price; // Добавляем и lowercase версию
      }
    });

    // Сохраняем в кэш
    tokenPricesCache = { prices, timestamp: Date.now() };
    console.log(`💵 [CoinGecko] Получены цены для ${Object.keys(prices).length / 2} токенов (cached 5 min)`);
    return prices;
  } catch (error) {
    console.error('[CoinGecko] getTokenPrices error:', error.message);
    // Возвращаем кэш если есть, иначе пустой объект
    if (Object.keys(tokenPricesCache.prices).length > 0) {
      console.warn('[CoinGecko] Используем кэшированные цены');
      return tokenPricesCache.prices;
    }
    return {};
  }
}

/**
 * Получает цены токенов из Pikespeak API.
 * @param {Array<string>} contracts - Массив контрактов токенов
 * @returns {Promise<Object>} Объект с ценами токенов в USD (contract -> price)
 */
async function getPikespeakPrices(contracts) {
  if (!PIKESPEAK_API_KEY) {
    console.log('[Pikespeak] API key не задан, пропускаем');
    return {};
  }

  try {
    const prices = {};
    let foundCount = 0;

    // Pikespeak API - получаем цены по одному токену
    // Ограничиваем до 30 запросов, чтобы не превысить rate limit
    const contractsToCheck = contracts.slice(0, 30);

    for (const contract of contractsToCheck) {
      try {
        const url = `${PIKESPEAK_API_URL}/token/price/${encodeURIComponent(contract)}`;
        const response = await axios.get(url, {
          timeout: 5000, // Короткий timeout для каждого запроса
          headers: { 'x-api-key': PIKESPEAK_API_KEY },
        });

        // Логируем первый ответ для отладки
        if (foundCount === 0 && process.env.NODE_ENV !== 'production') {
          console.log(`[Pikespeak DEBUG] Первый ответ для ${contract}:`, JSON.stringify(response.data).substring(0, 200));
        }

        const price = response.data?.price || response.data?.usd || response.data;
        const priceNum = typeof price === 'string' ? parseFloat(price) : (typeof price === 'number' ? price : 0);

        if (!isNaN(priceNum) && priceNum > 0) {
          prices[contract] = priceNum;
          prices[contract.toLowerCase()] = priceNum;
          foundCount++;
          
          if (process.env.NODE_ENV !== 'production' && foundCount <= 3) {
            console.log(`[Pikespeak] Найдена цена для ${contract.substring(0, 30)}... = $${priceNum}`);
          }
        }
      } catch (err) {
        // Логируем только первую ошибку
        if (foundCount === 0 && process.env.NODE_ENV !== 'production') {
          console.error(`[Pikespeak DEBUG] Ошибка для ${contract}:`, err.message);
        }
      }
    }

    console.log(`💵 [Pikespeak] Получены цены для ${foundCount} токенов`);
    return prices;
  } catch (error) {
    console.error('[Pikespeak] getPikespeakPrices error:', error.message);
    return {};
  }
}

/**
 * Получает цены токенов из Ref Finance (основной DEX на NEAR).
 * @param {Array<string>} contracts - Массив контрактов токенов
 * @returns {Promise<Object>} Объект с ценами токенов в USD (contract -> price)
 */
async function getRefFinancePrices(contracts) {
  try {
    // Ref Finance Indexer API для получения цен
    const url = 'https://indexer.ref.finance/list-token-price';
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    
    const refPrices = response.data || {};
    
    // ОТЛАДКА: логируем первые 5 ключей для понимания формата
    if (process.env.NODE_ENV !== 'production') {
      const keys = Object.keys(refPrices).slice(0, 5);
      console.log('[Ref Finance DEBUG] Примеры ключей:', keys);
      if (keys.length > 0) {
        console.log('[Ref Finance DEBUG] Пример цены:', refPrices[keys[0]]);
      }
    }
    
    const prices = {};
    let foundCount = 0;
    
    // Преобразуем цены из Ref Finance для наших контрактов
    contracts.forEach(contract => {
      // Пробуем разные варианты контракта
      const variants = [
        contract,
        contract.toLowerCase(),
        `${contract}.factory.bridge.near`,
        `${contract}.factory.bridge.near`.toLowerCase(),
      ];
      
      let foundPrice = null;
      for (const variant of variants) {
        const price = refPrices[variant];
        if (price) {
          foundPrice = price;
          break;
        }
      }
      
      if (foundPrice) {
        const priceNum = typeof foundPrice === 'string' 
          ? parseFloat(foundPrice) 
          : (typeof foundPrice === 'number' 
            ? foundPrice 
            : parseFloat(foundPrice?.price || 0));
            
        if (!isNaN(priceNum) && priceNum > 0) {
          prices[contract] = priceNum;
          prices[contract.toLowerCase()] = priceNum;
          foundCount++;
          
          if (process.env.NODE_ENV !== 'production' && foundCount <= 3) {
            console.log(`[Ref Finance] Найдена цена для ${contract.substring(0, 30)}... = $${priceNum}`);
          }
        }
      }
    });
    
    console.log(`💵 [Ref Finance] Получены цены для ${Object.keys(prices).length / 2} токенов из ${Object.keys(refPrices).length} доступных`);
    return prices;
  } catch (error) {
    console.error('[Ref Finance] getRefFinancePrices error:', error.message);
    return {};
  }
}

/**
 * Получает цены токенов из Intear Token Indexer (RHEA Finance + все токены NEAR).
 * @param {Array<string>} contracts - Массив контрактов токенов
 * @returns {Promise<Object>} Объект с ценами токенов в USD (contract -> price)
 */
async function getIntearPrices(contracts) {
  try {
    // Intear Token Indexer API - совместим с Ref Finance, но покрывает больше токенов
    const url = `${INTEAR_API_URL}/list-token-price`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    
    const intearPrices = response.data || {};
    
    // ОТЛАДКА: логируем количество доступных токенов
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Intear] Доступно ${Object.keys(intearPrices).length} токенов`);
    }
    
    const prices = {};
    let foundCount = 0;
    
    // Преобразуем цены из Intear для наших контрактов
    contracts.forEach(contract => {
      // Пробуем разные варианты контракта
      const variants = [
        contract,
        contract.toLowerCase(),
      ];
      
      for (const variant of variants) {
        const priceData = intearPrices[variant];
        if (priceData) {
          // Intear возвращает объект с полем price
          const priceNum = typeof priceData.price === 'string' 
            ? parseFloat(priceData.price) 
            : (typeof priceData.price === 'number' ? priceData.price : 0);
          
          if (!isNaN(priceNum) && priceNum > 0) {
            prices[contract] = priceNum;
            prices[contract.toLowerCase()] = priceNum;
            foundCount++;
            
            if (process.env.NODE_ENV !== 'production' && foundCount <= 5) {
              console.log(`[Intear] Найдена цена для ${contract.substring(0, 30)}... = $${priceNum}`);
            }
            break;
          }
        }
      }
    });
    
    console.log(`💵 [Intear] Получены цены для ${foundCount} токенов`);
    return prices;
  } catch (error) {
    console.error('[Intear] getIntearPrices error:', error.message);
    return {};
  }
}

/**
 * Получает детальную аналитику транзакций за указанный период.
 * @param {string} address - NEAR адрес
 * @param {string} period - Период: 'week' (7 дней), 'month' (30 дней), 'all' (90 дней)
 * @returns {Promise<Object>} Аналитика с газом, транзакциями, активностью по дням и протоколам
 */
/**
 * Получить аналитику транзакций за период
 * ВРЕМЕННО ОТКЛЮЧЕНО из-за Nearblocks 429
 */
async function getAnalytics(address, period = 'week') {
  await rateLimitDelay();
  console.log(`⚠️ [Analytics] Аналитика временно отключена (Nearblocks 429)`);
  return getEmptyAnalytics(period);
}

/**
 * Возвращает пустую структуру аналитики.
 */
function getEmptyAnalytics(period = 'week') {
  const daysCount = period === 'week' ? 7 : (period === 'month' ? 30 : 30);
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const activityByDay = [];
  
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const label = period === 'all' || period === 'month' 
      ? `${d.getDate()}/${d.getMonth() + 1}` 
      : dayNames[d.getDay()];
    activityByDay.push({ day: label, txs: 0 });
  }
  
  return {
    totalTxs: 0,
    gasSpent: 0,
    gasUSD: '0.00',
    uniqueContracts: 0,
    mostActive: 'N/A',
    insights: [
      { type: 'info', text: 'Нет транзакций за этот период', icon: '📭' }
    ],
    breakdown: {
      gaming: { count: 0, percent: 0, usd: 0 },
      defi: { count: 0, percent: 0, usd: 0 },
      transfers: { count: 0, percent: 0, usd: 0 },
      nft: { count: 0, percent: 0, usd: 0 },
    },
    topContracts: [],
    activityByDay,
  };
}

/**
 * Получает список NFT на балансе пользователя.
 * @param {string} address - NEAR адрес
 * @returns {Promise<Array>} Массив NFT с метаданными
 */
/**
 * Преобразует IPFS URL в публичный HTTP URL
 */
function convertIpfsToHttp(url) {
  if (!url) return null;
  
  // Если это IPFS URL
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  
  // Если это уже HTTP URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Если это просто IPFS hash
  if (url.startsWith('Qm') || url.startsWith('ba')) {
    return `https://ipfs.io/ipfs/${url}`;
  }
  
  return url;
}

async function getNFTBalance(address) {
  try {
    const allNFTs = [];
    let page = 1;
    const perPage = 100; // Максимум NFT за запрос
    
    // Делаем несколько запросов для получения всех NFT (до 300)
    while (page <= 3) { // Максимум 3 страницы = 300 NFT
      const url = `${NEARBLOCKS_API_URL}/account/${address}/inventory`;
      const response = await axios.get(url, { 
        timeout: API_TIMEOUT,
        params: { page, per_page: perPage }
      });
      
      const nfts = response.data.inventory?.nfts ?? [];
      
      if (nfts.length === 0) break; // Больше NFT нет
      
      allNFTs.push(...nfts);
      
      if (nfts.length < perPage) break; // Последняя страница
      
      page++;
    }
    
    console.log(`🎨 [NFT] Загружено ${allNFTs.length} NFT для ${address} (${page - 1} страниц)`);
    
    // Форматируем NFT для удобного отображения
    return allNFTs.map(nft => {
      // Пробуем разные пути к metadata
      const metadata = nft.nft?.metadata || nft.metadata || {};
      const title = metadata.title || nft.token_id;
      const description = metadata.description || '';
      
      // Пробуем разные пути к media и конвертируем IPFS
      let media = metadata.media || nft.nft?.media || nft.media || null;
      media = convertIpfsToHttp(media);
      
      return {
        contract: nft.contract,
        token_id: nft.token_id,
        title,
        description,
        media,
        collection: nft.contract,
        collection_id: metadata.collection_id || nft.contract,
      };
    });
  } catch (error) {
    console.error('getNFTBalance error:', error.message);
    return [];
  }
}

/**
 * Получает застейканные NFT в HOT Craft.
 * @param {string} address - NEAR адрес
 * @returns {Promise<Array>} Массив застейканных NFT
 */
async function getHotStakedNFTs(address) {
  try {
    // HOT Craft контракт: game.hot.tg
    // Вызываем метод get_user для получения информации о застейканных NFT
    const argsBase64 = Buffer.from(
      JSON.stringify({ account_id: address })
    ).toString('base64');

    const response = await axios.post(
      NEAR_RPC_URL,
      {
        jsonrpc: '2.0',
        id: 'dontcare',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: HOT_CONTRACT,
          method_name: 'get_user',
          args_base64: argsBase64,
        },
      },
      { timeout: API_TIMEOUT }
    );

    if (response.data.error) {
      console.log('[HOT Staked NFTs] Аккаунт не зарегистрирован в HOT');
      return [];
    }

    const result = response.data.result?.result;
    if (!result || !Array.isArray(result)) return [];

    const jsonStr = Buffer.from(result).toString('utf8');
    const userData = JSON.parse(jsonStr);
    
    console.log('[HOT Staked NFTs] User data получена:', JSON.stringify(userData).substring(0, 200));
    
    // Извлекаем информацию о застейканных NFT из ответа
    // Структура зависит от HOT контракта, нужно проверить реальный ответ
    const stakedNFTs = userData.staked_nfts || userData.nfts || [];
    
    console.log(`🔥 [HOT] Найдено ${stakedNFTs.length} застейканных NFT`);
    
    return stakedNFTs;
  } catch (error) {
    console.error('getHotStakedNFTs error:', error.message);
    return [];
  }
}

module.exports = {
  getBalance,
  getTokenBalance,
  getAllTokens,
  getTokensWithPrices,
  getStakingBalance,
  getTransactionHistory,
  getTransactionDetails,
  getHotClaimStatus,
  getNearPrice,
  getAnalytics,
  getNFTBalance,
  getHotStakedNFTs,
  TOKEN_DECIMALS_MAP,
  TOKEN_COINGECKO_MAP,
};