require('dotenv/config');
const cron = require('node-cron');
const { Telegraf, Markup } = require('telegraf');
const {
  getBalance,
  getTokenBalance,
  getTokensWithPrices,
  getStakingBalance,
  getTransactionHistory,
  getHotClaimStatus,
  getNearPrice,
  TOKEN_DECIMALS_MAP,
} = require('./services/nearService');
const { generatePulseReport } = require('./services/aiService');
const { getDb, updateUserAddress, setHotNotify, getUser, getUsersForMonitoring, updateLastHotNotify, NOTIFY_COOLDOWN_SEC, saveBalanceSnapshot, getBalance24hAgo, getBalanceHistory } = require('./config/database');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не задан в .env');
  process.exit(1);
}

const bot = new Telegraf(token);

// Константы для оформления
const APPLE_STYLE_HEADER = ' **NearPulse | Finance**\n';

/**
 * Получает decimals для токена с применением эвристики
 * @param {string} contract - Контракт токена
 * @returns {number} Количество decimals
 */
function getTokenDecimals(contract) {
  // Проверяем в маппинге (приоритет)
  const decimals = TOKEN_DECIMALS_MAP[contract] || TOKEN_DECIMALS_MAP[contract.toLowerCase()];
  if (decimals) return decimals;
  
  // Применяем эвристику для известных паттернов
  if (contract.includes('.factory.bridge.near')) {
    // Bridged токены обычно 18 decimals, кроме USDT/USDC
    if (contract.includes('dac17f958d2ee523a2206206994597c13d831ec7')) return 6; // USDT
    if (contract.includes('a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')) return 6; // USDC
    if (contract.includes('2260fac5e5542a773aa44fbcfedf7c193bc2c599')) return 8; // wBTC
    return 18;
  }
  
  if (contract.includes('meme-cooking.near')) return 18;
  if (contract.includes('.tkn.near')) return 18;
  if (contract.includes('token.') && contract.includes('.near')) return 18;
  if (contract === 'wrap.near') return 24; // wNEAR
  
  // По умолчанию 18 decimals (стандарт для большинства токенов)
  return 18;
}

/**
 * Форматирует количество токена в читаемый вид
 * @param {number} amount - Количество токена (нормализованное)
 * @returns {string} Отформатированная строка
 */
function formatTokenAmount(amount) {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(2) + 'M';
  } else if (amount >= 1000) {
    return (amount / 1000).toFixed(2) + 'K';
  } else if (amount >= 1) {
    return amount.toLocaleString('en-US', { maximumFractionDigits: 4 });
  } else if (amount > 0) {
    return amount.toFixed(6).replace(/\.?0+$/, '');
  }
  return '0';
}

bot.start((ctx) => {
  ctx.reply(
    `${APPLE_STYLE_HEADER}\n` +
    'Привет! Я твой персональный аналитик NEAR.\n\n' +
    'Я помогу тебе видеть твои активы так, как если бы они были в Apple Wallet — просто и понятно.\n\n' +
    'Отправь мне адрес через команду:\n/balance <имя>.near'
  );
});

bot.help((ctx) => {
  ctx.reply(
    '📋 **Доступные инструменты:**\n\n' +
    '💰 /balance <адрес> — Баланс, стейкинг и HOT.\n' +
    '📊 /analytics <адрес> — Аналитика и изменения за 24ч.\n' +
    '📜 /transactions <адрес> — История последних 10 транзакций.\n' +
    '📈 /pulse <адрес> — ИИ-анализ последних транзакций.\n' +
    '🌐 /app <адрес> — Открыть Mini App с аналитикой.\n' +
    '⚙️ /settings — Настройки и уведомления.\n' +
    '🔔 /test_notify — Тест уведомления (проверка доставки).'
  );
});

bot.command('balance', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];

  if (!address) {
    await ctx.reply('📍 Пожалуйста, укажите адрес. Пример: /balance vlad.near');
    return;
  }

  try {
    const loadingMsg = await ctx.reply('⏳ Сканирую блокчейн...');

    const [nearData, stakingBalance, hotBalance, claimStatus, nearPrice, categorizedTokens] = await Promise.all([
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
      getHotClaimStatus(address),
      getNearPrice().catch(() => null), // Если не удалось получить цену, возвращаем null
      getTokensWithPrices(address, 1), // Фильтр: минимум $1
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    const formatNum = (n) =>
      n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatUsd = (nearAmount) => {
      if (!nearPrice) return '';
      const usd = nearAmount * nearPrice;
      return ` (~$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    };

    const formatTokenAmount = (amount) => {
      // Форматируем большие числа компактно
      if (amount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
      if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
      if (amount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
      return formatNum(amount);
    };

    const totalValue = nearData.near + stakingBalance;

    let claimLine = '';
    if (claimStatus) {
      claimLine = claimStatus.readyToClaim
        ? '\n🔥 **Пора забирать HOT!**\n'
        : `\n⏱ **До следующего клейма:** ${claimStatus.hoursUntilClaim} ч ${claimStatus.minutesUntilClaim} мин\n`;
    }

    // Формируем секцию с основными токенами
    let majorTokensSection = '';
    if (categorizedTokens.major.length > 0) {
      majorTokensSection = '\n\n💎 **Основные токены:**\n';
      categorizedTokens.major.forEach(token => {
        const amount = formatTokenAmount(token.amount);
        const usdStr = token.price > 0 ? ` (~$${formatNum(token.usdValue)})` : '';
        majorTokensSection += `• ${token.symbol}: ${amount}${usdStr}\n`;
      });
    }

    // Формируем секцию с другими токенами (> $1)
    let filteredTokensSection = '';
    if (categorizedTokens.filtered.length > 0) {
      filteredTokensSection = '\n💰 **Другие токены:**\n';
      categorizedTokens.filtered.forEach(token => {
        const amount = formatTokenAmount(token.amount);
        const usdStr = token.price > 0 ? ` (~$${formatNum(token.usdValue)})` : '';
        filteredTokensSection += `• ${token.symbol}: ${amount}${usdStr}\n`;
      });
    }

    // Информация о скрытых токенах (< $1)
    let hiddenTokensInfo = '';
    if (categorizedTokens.hidden.length > 0) {
      hiddenTokensInfo = `\n🔻 *${categorizedTokens.hidden.length} токенов скрыто (< $1)*`;
    }

    const message =
      `${APPLE_STYLE_HEADER}\n` +
      `👤 **Аккаунт:** \`${address}\`\n` +
      '━━━━━━━━━━━━━━━━━━\n' +
      `📊 **Общая ценность:** ${formatNum(totalValue)} NEAR${formatUsd(totalValue)}\n` +
      '---\n' +
      `💰 **Доступно:** ${formatNum(nearData.near)} NEAR${formatUsd(nearData.near)}\n` +
      `🔒 **В стейкинге:** ${formatNum(stakingBalance)} NEAR${formatUsd(stakingBalance)}\n` +
      `🔥 **HOT:** ${formatNum(hotBalance)}` +
      claimLine +
      majorTokensSection +
      filteredTokensSection +
      hiddenTokensInfo +
      '\n━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message);

    const telegramId = ctx.from?.id;
    if (telegramId) {
      updateUserAddress(telegramId, address);
      saveBalanceSnapshot(telegramId, address, nearData.near + stakingBalance, hotBalance);
    }
  } catch (error) {
    console.error('Ошибка в боте:', error.message);
    await ctx.reply('❌ Не удалось найти этот адрес или получить данные. Проверьте правильность написания.');
  }
});

bot.command('analytics', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];

  if (!address) {
    await ctx.reply('📍 Пожалуйста, укажите адрес. Пример: /analytics vlad.near');
    return;
  }

  try {
    const loadingMsg = await ctx.reply('⏳ Анализирую данные...');

    const [nearData, stakingBalance, hotBalance, nearPrice, categorizedTokens, txns] = await Promise.all([
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
      getNearPrice().catch(() => null),
      getTokensWithPrices(address, 1),
      getTransactionHistory(address).catch(() => []),
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    const formatNum = (n) =>
      n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatUsd = (nearAmount) => {
      if (!nearPrice) return '';
      const usd = nearAmount * nearPrice;
      return ` (~$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    };

    const totalNear = nearData.near + stakingBalance;
    const totalUsd = nearPrice ? totalNear * nearPrice : 0;

    // Получаем баланс 24ч назад
    const telegramId = ctx.from?.id;
    const balance24h = telegramId ? getBalance24hAgo(telegramId) : null;

    // 📈 Изменение за 24 часа
    let changeSection = '';
    if (balance24h) {
      const nearChange = totalNear - balance24h.nearBalance;
      const hotChange = hotBalance - balance24h.hotBalance;
      const percentChange = balance24h.nearBalance > 0 
        ? ((nearChange / balance24h.nearBalance) * 100)
        : 0;

      const changeIcon = nearChange >= 0 ? '📈' : '📉';
      const changeSign = nearChange >= 0 ? '+' : '';
      const changeColor = nearChange >= 0 ? '🟢' : '🔴';

      changeSection = 
        '\n📊 **Изменение за 24 часа:**\n' +
        `${changeIcon} NEAR: ${changeSign}${formatNum(nearChange)} (${changeSign}${percentChange.toFixed(2)}%)${formatUsd(nearChange)}\n`;

      if (Math.abs(hotChange) > 0.01) {
        const hotChangeIcon = hotChange >= 0 ? '📈' : '📉';
        changeSection += `${hotChangeIcon} HOT: ${changeSign}${formatNum(hotChange)}\n`;
      }
    } else {
      changeSection = '\n📊 **Изменение за 24 часа:**\n_Данных пока нет. Проверьте позже!_\n';
    }

    // 💰 Распределение активов
    const totalTokensUsd = categorizedTokens.major.reduce((sum, t) => sum + t.usdValue, 0) +
                          categorizedTokens.filtered.reduce((sum, t) => sum + t.usdValue, 0);
    const totalPortfolio = totalUsd + totalTokensUsd;

    const nearPercent = totalPortfolio > 0 ? (totalUsd / totalPortfolio * 100) : 0;
    const tokensPercent = totalPortfolio > 0 ? (totalTokensUsd / totalPortfolio * 100) : 0;

    // Визуальный бар (10 символов)
    const createBar = (percent) => {
      const filled = Math.round(percent / 10);
      const empty = 10 - filled;
      return '█'.repeat(filled) + '░'.repeat(empty);
    };

    const distributionSection =
      '\n💼 **Распределение активов:**\n' +
      `💎 NEAR: ${nearPercent.toFixed(1)}%\n` +
      `${createBar(nearPercent)} $${formatNum(totalUsd)}\n` +
      `🪙 Токены: ${tokensPercent.toFixed(1)}%\n` +
      `${createBar(tokensPercent)} $${formatNum(totalTokensUsd)}\n`;

    // 🔥 Топ 5 токенов
    const allTokens = [...categorizedTokens.major, ...categorizedTokens.filtered]
      .sort((a, b) => b.usdValue - a.usdValue)
      .slice(0, 5);

    let topTokensSection = '';
    if (allTokens.length > 0) {
      topTokensSection = '\n🏆 **Топ токенов:**\n';
      allTokens.forEach((token, idx) => {
        const percent = totalPortfolio > 0 ? (token.usdValue / totalPortfolio * 100) : 0;
        topTokensSection += `${idx + 1}. ${token.symbol}: $${formatNum(token.usdValue)} (${percent.toFixed(1)}%)\n`;
      });
    }

    // 📊 Активность
    const last24h = txns.filter(tx => {
      const txTime = parseInt(tx.block_timestamp) / 1000000; // nanoseconds to ms
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return txTime > dayAgo;
    });

    const activitySection = 
      '\n📈 **Активность (24ч):**\n' +
      `Транзакций: ${last24h.length}\n`;

    const message =
      `${APPLE_STYLE_HEADER}\n` +
      `📊 **Аналитика**\n` +
      `👤 **Аккаунт:** \`${address}\`\n` +
      '━━━━━━━━━━━━━━━━━━\n' +
      `💰 **Общий портфель:** $${formatNum(totalPortfolio)}\n` +
      changeSection +
      distributionSection +
      topTokensSection +
      activitySection +
      '\n━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message);

  } catch (error) {
    console.error('Ошибка в /analytics:', error.message);
    await ctx.reply('❌ Не удалось получить аналитику. Попробуйте позже.');
  }
});

// Временное хранилище деталей транзакций
const txDetailsCache = new Map();

bot.command('transactions', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];

  if (!address) {
    await ctx.reply('📍 Пожалуйста, укажите адрес. Пример: /transactions vlad.near');
    return;
  }

  try {
    const loadingMsg = await ctx.reply('⏳ Загружаю историю транзакций...');

    const [txns, nearPrice] = await Promise.all([
      getTransactionHistory(address),
      getNearPrice().catch(() => null),
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    // Проверяем что txns это массив и не пустой
    if (!Array.isArray(txns) || txns.length === 0) {
      console.log('[/transactions] txns is not array or empty:', txns);
      await ctx.reply('📭 История транзакций пуста или недоступна.');
      return;
    }

    const formatNum = (n) =>
      n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatDate = (timestamp) => {
      const date = new Date(timestamp / 1000000); // nanoseconds to milliseconds
      const now = new Date();
      const diff = now - date;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours < 24) {
        return `${hours}ч ${minutes}м назад`;
      } else {
        const days = Math.floor(hours / 24);
        return `${days}д назад`;
      }
    };

    let message = `${APPLE_STYLE_HEADER}\n` +
                  `📜 **История транзакций**\n` +
                  `👤 **Аккаунт:** \`${address}\`\n` +
                  '━━━━━━━━━━━━━━━━━━\n\n';

    // Группируем транзакции по transaction_hash
    const groupedTxns = {};
    txns.forEach(tx => {
      const hash = tx.transaction_hash;
      if (!groupedTxns[hash]) {
        groupedTxns[hash] = [];
      }
      groupedTxns[hash].push(tx);
    });
    
    // Функция для анализа группы транзакций и определения итогового действия
    const analyzeTransactionGroup = (txGroup, userAddress) => {
      // Фильтруем system транзакции
      const relevantTxs = txGroup.filter(tx => 
        tx.receiver_account_id !== 'system' && 
        tx.predecessor_account_id !== 'system'
      );
      
      if (relevantTxs.length === 0) return null;
      
      // Собираем информацию о всех транзакциях в группе
      const contracts = new Set();
      let totalNearDeposit = 0;
      let totalNearWithdraw = 0;
      
      relevantTxs.forEach(tx => {
        contracts.add(tx.receiver_account_id);
        const deposit = tx.actions_agg?.deposit ? parseFloat(tx.actions_agg.deposit) / 1e24 : 0;
        
        if (tx.predecessor_account_id === userAddress) {
          totalNearDeposit += deposit;
        } else if (tx.receiver_account_id === userAddress) {
          totalNearWithdraw += deposit;
        }
      });
      
      const contractList = Array.from(contracts);
      const firstTx = relevantTxs[0];
      const timestamp = firstTx.block_timestamp;
      const txCount = relevantTxs.length;
      
      let icon = '';
      let description = '';
      let showAmount = false;
      let amount = 0;
      
      // Определяем тип операции по контрактам
      const hasRef = contractList.some(c => c.includes('ref-finance'));
      const hasRhea = contractList.some(c => c.includes('rhea'));
      const hasHot = contractList.some(c => c.includes('hot.tg') || c === 'game.hot.tg');
      const hasMoon = contractList.some(c => c.includes('harvest-moon'));
      const hasMeteor = contractList.some(c => c.includes('meteor'));
      
      // 🔄 Swap операция (несколько транзакций с DEX)
      if ((hasRef || hasRhea) && txCount > 1) {
        icon = '🔄';
        const dexName = hasRef ? 'Ref Finance' : 'RHEA';
        description = `Swap на ${dexName}`;
        
        if (totalNearDeposit > 0 && totalNearWithdraw > 0) {
          const diff = Math.abs(totalNearWithdraw - totalNearDeposit);
          amount = diff;
          showAmount = diff > 0.01;
          description += totalNearWithdraw > totalNearDeposit ? ' (получено NEAR)' : ' (отправлено NEAR)';
        } else if (totalNearDeposit > 0) {
          amount = totalNearDeposit;
          showAmount = true;
          description += ' → Токены';
        }
      }
      // 🎁 Claim награды
      else if (hasHot || hasMoon || hasMeteor) {
        icon = '🎁';
        if (hasHot) description = 'Claim HOT';
        else if (hasMoon) description = 'Claim MOON';
        else description = 'Claim Meteor';
        showAmount = false;
      }
      // 💸 Простой перевод NEAR
      else if (totalNearDeposit > 0.01 && txCount === 1) {
        const isOutgoing = firstTx.predecessor_account_id === userAddress;
        icon = isOutgoing ? '📤' : '📥';
        const otherParty = isOutgoing ? firstTx.receiver_account_id : firstTx.predecessor_account_id;
        description = isOutgoing ? `Перевод → ${otherParty}` : `Получено ← ${otherParty}`;
        amount = totalNearDeposit;
        showAmount = true;
      }
      // 🪙 Перевод токенов (FT)
      else if (contractList.some(c => c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking'))) {
        icon = '🪙';
        const tokenContract = contractList.find(c => c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking'));
        
        // Умное извлечение имени токена
        let tokenName = 'TOKEN';
        if (tokenContract) {
          const parts = tokenContract.split('.');
          
          // token.0xshitzu.near → 0XSHITZU
          if (parts[0] === 'token' && parts.length >= 3) {
            tokenName = parts[1].toUpperCase();
          }
          // jambo-1679.meme-cooking.near → JAMBO
          else if (tokenContract.includes('meme-cooking')) {
            tokenName = parts[0].split('-')[0].toUpperCase();
          }
          // abc.tkn.near → ABC
          else if (tokenContract.includes('.tkn.')) {
            tokenName = parts[0].toUpperCase();
          }
          // Другие случаи - первая часть
          else {
            tokenName = parts[0].toUpperCase();
          }
        }
        
        const isOutgoing = firstTx.predecessor_account_id === userAddress;
        description = isOutgoing ? `Отправлено ${tokenName}` : `Получено ${tokenName}`;
        showAmount = false;
      }
      // Скрываем малозначительные операции
      else if (totalNearDeposit < 0.001 && txCount <= 2) {
        return null;
      }
      // 📝 Сложный вызов контракта
      else {
        icon = '📝';
        description = `Вызов контракта (${txCount} транзакций)`;
        amount = totalNearDeposit;
        showAmount = amount > 0.01;
      }
      
      // Собираем расширенные детали транзакций (для отображения)
      const detailedSteps = relevantTxs.map(tx => {
        const deposit = tx.actions_agg?.deposit ? parseFloat(tx.actions_agg.deposit) / 1e24 : 0;
        // Gas fee из outcomes_agg.transaction_fee (в yoctoNEAR)
        const gasFee = tx.outcomes_agg?.transaction_fee ? parseFloat(tx.outcomes_agg.transaction_fee) / 1e24 : 0;
        
        // Извлекаем информацию о токенах из actions
        // ВАЖНО: actions - это ОБЪЕКТ, а не массив!
        let tokenTransfers = [];
        let actionDetails = null;
        
        if (tx.actions && typeof tx.actions === 'object') {
          // Преобразуем объект в массив
          const actionsArray = Object.values(tx.actions);
          
          actionsArray.forEach(action => {
            if (action.action === 'FUNCTION_CALL') {
              const methodName = action.method;
              
              // FT Transfer
              if (methodName === 'ft_transfer' || methodName === 'ft_transfer_call') {
                const receiver = tx.receiver_account_id;
                // Извлекаем название токена из контракта
                let tokenName = 'TOKEN';
                const parts = receiver.split('.');
                if (parts[0] === 'token' && parts.length >= 3) {
                  tokenName = parts[1].toUpperCase();
                } else if (receiver.includes('meme-cooking')) {
                  tokenName = parts[0].split('-')[0].toUpperCase();
                } else if (receiver.includes('.tkn.')) {
                  tokenName = parts[0].toUpperCase();
                } else {
                  tokenName = parts[0].toUpperCase();
                }
                
                // Извлекаем количество токена из args
                let amount = null;
                if (action.args && action.args.amount) {
                  const rawAmount = action.args.amount;
                  amount = typeof rawAmount === 'string' ? rawAmount : String(rawAmount);
                }
                
                // Определяем направление: outgoing (пользователь отправляет)
                const isOutgoing = tx.predecessor_account_id === userAddress;
                
                // Для swap транзакций (когда receiver = ref-finance) - это ОТДАННЫЕ токены
                // Считаем их как OUT, даже если технически они идут к DEX
                const isSwapOut = action.args?.receiver_id?.includes('ref-finance') || 
                                  action.args?.receiver_id?.includes('rhea');
                
                tokenTransfers.push({
                  token: tokenName,
                  contract: receiver,
                  action: 'transfer',
                  amount: amount, // raw amount (строка)
                  direction: (isOutgoing || isSwapOut) ? 'out' : 'in',
                });
              }
              
              // Сохраняем описание метода для display
              actionDetails = {
                method: methodName,
                type: 'FUNCTION_CALL'
              };
            } else if (action.action === 'TRANSFER') {
              actionDetails = {
                method: 'NEAR Transfer',
                type: 'TRANSFER'
              };
            }
          });
        }
        
        // ПАРСИНГ ВХОДЯЩИХ ТОКЕНОВ из outcomes/logs
        // При swap токены ПРИХОДЯТ к пользователю через события в outcomes
        if (tx.outcomes && typeof tx.outcomes === 'object') {
          const outcomesArray = Object.values(tx.outcomes);
          
          
          outcomesArray.forEach(outcome => {
            // Проверяем logs на наличие FT events
            if (outcome.logs && Array.isArray(outcome.logs)) {
              outcome.logs.forEach(log => {
                // EVENT_JSON формат: "EVENT_JSON:{...}"
                if (log.startsWith('EVENT_JSON:')) {
                  try {
                    const eventData = JSON.parse(log.substring(11));
                    
                    // FT Transfer event
                    if (eventData.standard === 'nep141' && eventData.event === 'ft_transfer') {
                      eventData.data?.forEach(transfer => {
                        // Проверяем что токены ПРИШЛИ к пользователю
                        if (transfer.new_owner_id === userAddress || transfer.receiver_id === userAddress) {
                          const tokenContract = tx.receiver_account_id;
                          const amount = transfer.amount;
                          
                          // Извлекаем имя токена
                          let tokenName = 'TOKEN';
                          const parts = tokenContract.split('.');
                          if (parts[0] === 'token' && parts.length >= 3) {
                            tokenName = parts[1].toUpperCase();
                          } else if (tokenContract.includes('meme-cooking')) {
                            tokenName = parts[0].split('-')[0].toUpperCase();
                          } else if (tokenContract.includes('.tkn.')) {
                            tokenName = parts[0].toUpperCase();
                          } else {
                            tokenName = parts[0].toUpperCase();
                          }
                          
                          tokenTransfers.push({
                            token: tokenName,
                            contract: tokenContract,
                            action: 'receive',
                            amount: amount,
                            direction: 'in',
                          });
                          
                          if (process.env.NODE_ENV !== 'production') {
                            console.log(`[FT Received DEBUG] ${tokenName}: ${amount} from ${transfer.old_owner_id || 'unknown'}`);
                          }
                        }
                      });
                    }
                  } catch (e) {
                    // Игнорируем ошибки парсинга
                  }
                }
              });
            }
          });
        }
        
        // ТАКЖЕ проверяем receipt_outcome.logs (альтернативное место для логов)
        if (tx.receipt_outcome && tx.receipt_outcome.logs && Array.isArray(tx.receipt_outcome.logs)) {
          tx.receipt_outcome.logs.forEach(log => {
            if (log.startsWith('EVENT_JSON:')) {
              try {
                const eventData = JSON.parse(log.substring(11));
                
                // FT Transfer event
                if (eventData.standard === 'nep141' && eventData.event === 'ft_transfer') {
                  eventData.data?.forEach(transfer => {
                    // Проверяем что токены ПРИШЛИ к пользователю
                    if (transfer.new_owner_id === userAddress || transfer.receiver_id === userAddress) {
                      const tokenContract = tx.receiver_account_id;
                      const amount = transfer.amount;
                      
                      // Извлекаем имя токена
                      let tokenName = 'TOKEN';
                      const parts = tokenContract.split('.');
                      if (parts[0] === 'token' && parts.length >= 3) {
                        tokenName = parts[1].toUpperCase();
                      } else if (tokenContract.includes('meme-cooking')) {
                        tokenName = parts[0].split('-')[0].toUpperCase();
                      } else if (tokenContract.includes('.tkn.')) {
                        tokenName = parts[0].toUpperCase();
                      } else {
                        tokenName = parts[0].toUpperCase();
                      }
                      
                      tokenTransfers.push({
                        token: tokenName,
                        contract: tokenContract,
                        action: 'receive',
                        amount: amount,
                        direction: 'in',
                      });
                      
                      if (process.env.NODE_ENV !== 'production') {
                        console.log(`[FT Received from receipt_outcome] ${tokenName}: ${amount} to ${userAddress}`);
                      }
                    }
                  });
                }
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
            }
          });
        }
        
        return {
          receiver: tx.receiver_account_id,
          predecessor: tx.predecessor_account_id,
          deposit,
          gasFee,
          tokenTransfers,
          actionDetails,
        };
      });
      
      // Анализируем ВСЮ группу для точного подсчета NEAR (включая system транзакции)
      let allNearSpent = 0;
      let allNearReceived = 0;
      
      // ОТЛАДКА: логируем все транзакции группы
      if (process.env.NODE_ENV !== 'production' && txGroup.length > 1) {
        console.log('\n[Анализ группы] userAddress:', userAddress);
        console.log('[Анализ группы] txGroup.length:', txGroup.length);
        txGroup.forEach((tx, i) => {
          const deposit = tx.actions_agg?.deposit ? parseFloat(tx.actions_agg.deposit) / 1e24 : 0;
          console.log(`[Анализ группы] Tx ${i+1}: ${tx.predecessor_account_id} → ${tx.receiver_account_id}, deposit: ${deposit}`);
        });
      }
      
      txGroup.forEach(tx => {
        const deposit = tx.actions_agg?.deposit ? parseFloat(tx.actions_agg.deposit) / 1e24 : 0;
        if (deposit > 0.0001) {
          if (tx.predecessor_account_id === userAddress) {
            allNearSpent += deposit;
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[Анализ группы] ✅ SPENT: ${deposit} NEAR от ${tx.predecessor_account_id}`);
            }
          } else if (tx.receiver_account_id === userAddress) {
            allNearReceived += deposit;
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[Анализ группы] ✅ RECEIVED: ${deposit} NEAR к ${tx.receiver_account_id}`);
            }
          }
        }
      });
      
      if (process.env.NODE_ENV !== 'production' && txGroup.length > 1) {
        console.log('[Анализ группы] ИТОГО: spent:', allNearSpent, 'received:', allNearReceived, '\n');
      }
      
      return {
        icon,
        description,
        amount,
        showAmount,
        timestamp,
        txCount,
        txHashes: relevantTxs.map(tx => tx.transaction_hash),
        details: detailedSteps,
        contracts: contractList, // Добавляем список контрактов для анализа
        userAddress, // Передаем адрес пользователя
        allNearSpent, // Реальные затраты NEAR (из всей группы)
        allNearReceived, // Реальное получение NEAR (из всей группы)
      };
    };
    
    // Анализируем группы транзакций
    let analyzed = Object.values(groupedTxns)
      .map(group => analyzeTransactionGroup(group, address))
      .filter(tx => tx !== null)
      .sort((a, b) => b.timestamp - a.timestamp); // Сортируем по времени (новые сверху)
    
    // ВТОРИЧНАЯ ГРУППИРОВКА: объединяем связанные swap операции
    const mergedSwaps = [];
    const processedIndices = new Set();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n[Вторичная группировка] Начало. Транзакций:', analyzed.length);
    }
    
    for (let i = 0; i < analyzed.length; i++) {
      if (processedIndices.has(i)) continue;
      
      const tx = analyzed[i];
      
      // ОТЛАДКА
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Вторичная группировка] Tx ${i}: ${tx.description}, NEAR spent: ${tx.allNearSpent}`);
      }
      
      // Проверяем: это wrap NEAR?
      if (tx.description.includes('wrap.near') && tx.allNearSpent > 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[Вторичная группировка] ✅ Найден wrap NEAR (${i}), ищем связанный swap...`);
        }
        
        // Ищем связанную транзакцию (swap токенов) в ОБОИХ направлениях в течение 3 минут
        let found = false;
        
        // Функция для проверки и объединения
        const tryMerge = (j) => {
          if (processedIndices.has(j)) return false;
          
          const nextTx = analyzed[j];
          const timeDiff = Math.abs((tx.timestamp - nextTx.timestamp) / 1e9); // в секундах
          
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Вторичная группировка]   Проверяем Tx ${j}: ${nextTx.description}, timeDiff: ${timeDiff}s`);
          }
          
          // Если это swap токенов и в пределах 3 минут
          if (timeDiff < 180 && 
              (nextTx.description.includes('Ref Finance') || 
               nextTx.description.includes('RHEA') ||
               (nextTx.description.includes('Получено') && nextTx.contracts.some(c => c.includes('token.'))))) {
            
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[Вторичная группировка]   ✅ НАШЛИ ПАРУ! Объединяем ${i} и ${j}`);
            }
            
            // ОБЪЕДИНЯЕМ в один swap!
            const tokenName = nextTx.description.match(/Получено (\w+)/) || 
                            nextTx.description.match(/(\w+)/);
            
            mergedSwaps.push({
              ...tx,
              icon: '🔄',
              description: `Swap: ${tx.allNearSpent.toFixed(2)} NEAR → ${tokenName ? tokenName[1] : 'TOKEN'}`,
              txCount: tx.txCount + nextTx.txCount,
              allNearSpent: tx.allNearSpent,
              allNearReceived: 0,
              details: [...tx.details, ...nextTx.details],
              contracts: [...tx.contracts, ...nextTx.contracts],
              txHashes: [...tx.txHashes, ...nextTx.txHashes],
              mergedFrom: [i, j],
            });
            
            processedIndices.add(i);
            processedIndices.add(j);
            return true;
          }
          return false;
        };
        
        // Ищем НАЗАД (более ранние по индексу)
        for (let j = i - 1; j >= 0 && !found; j--) {
          found = tryMerge(j);
        }
        
        // Если не нашли, ищем ВПЕРЕД
        if (!found) {
          for (let j = i + 1; j < analyzed.length && !found; j++) {
            found = tryMerge(j);
          }
        }
      }
      
      // Если не объединили, добавляем как есть
      if (!processedIndices.has(i)) {
        mergedSwaps.push(tx);
      }
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Вторичная группировка] ИТОГО: было ${analyzed.length}, стало ${mergedSwaps.length}\n`);
    }
    
    analyzed = mergedSwaps.slice(0, 15); // Берем первые 15 после объединения
    
    if (analyzed.length === 0) {
      await ctx.reply('📭 Нет значимых транзакций за последнее время.');
      return;
    }
    
    analyzed.forEach((tx, index) => {
      const timeStr = formatDate(tx.timestamp);
      
      message += `${tx.icon} **${tx.description}**\n`;
      
      if (tx.showAmount && tx.amount > 0) {
        const usdStr = nearPrice ? ` ($${formatNum(tx.amount * nearPrice)})` : '';
        message += `   💰 ${formatNum(tx.amount)} NEAR${usdStr}\n`;
      }
      
      message += `   🕐 ${timeStr}`;
      
      // Показываем количество транзакций в группе если их больше 1
      if (tx.txCount > 1) {
        message += ` • ${tx.txCount} транзакций`;
      }
      
      message += '\n\n';
    });

    message += '━━━━━━━━━━━━━━━━━━';

    // Сохраняем детали транзакций в кэш для кнопок
    const chatId = ctx.chat.id;
    txDetailsCache.set(chatId, analyzed);
    
    // Создаем inline кнопки для транзакций с деталями (txCount > 1)
    const buttons = [];
    let btnIndex = 1;
    analyzed.forEach((tx, index) => {
      if (tx.txCount > 1) {
        // Короткое описание для кнопки
        let btnLabel = `${tx.icon} Транзакция #${btnIndex}`;
        if (tx.description.includes('Swap')) {
          btnLabel = `${tx.icon} Swap #${btnIndex}`;
        } else if (tx.description.includes('Claim')) {
          btnLabel = `${tx.icon} Claim #${btnIndex}`;
        }
        btnLabel += ` (${tx.txCount})`;
        
        buttons.push([
          Markup.button.callback(btnLabel, `tx_${index}`)
        ]);
        btnIndex++;
      }
    });

    // Отправляем сообщение с кнопками (если они есть)
    if (buttons.length > 0) {
      await ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
    } else {
      await ctx.replyWithMarkdown(message);
    }

    const telegramId = ctx.from?.id;
    if (telegramId) {
      updateUserAddress(telegramId, address);
    }
  } catch (error) {
    console.error('Ошибка в /transactions:', error.message);
    await ctx.reply('❌ Не удалось получить историю транзакций. Попробуйте позже.');
  }
});

// Обработчик кнопок "Детали" для транзакций
bot.action(/^tx_(\d+)$/, async (ctx) => {
  try {
    const txIndex = parseInt(ctx.match[1]);
    const chatId = ctx.chat.id;
    
    // Получаем сохраненные детали из кэша
    const analyzedTxns = txDetailsCache.get(chatId);
    
    if (!analyzedTxns || !analyzedTxns[txIndex]) {
      await ctx.answerCbQuery('❌ Детали транзакции не найдены. Попробуйте /transactions заново.');
      return;
    }
    
    const tx = analyzedTxns[txIndex];
    
    // Формируем детальное описание
    let detailsMessage = `📋 **Детали транзакции**\n\n`;
    detailsMessage += `${tx.icon} **${tx.description}**\n`;
    detailsMessage += `🔢 Всего транзакций: ${tx.txCount}\n\n`;
    
    // Собираем сводку (что потрачено / получено)
    // Используем предрасчитанные значения из всей группы транзакций
    const totalNearSpent = tx.allNearSpent || 0;
    const totalNearReceived = tx.allNearReceived || 0;
    let totalGasFee = 0;
    const tokensInvolved = []; // Меняем на массив для хранения полной информации
    
    // ОТЛАДКА
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Сводка DEBUG] userAddress:', tx.userAddress);
      console.log('[Сводка DEBUG] allNearSpent:', tx.allNearSpent);
      console.log('[Сводка DEBUG] allNearReceived:', tx.allNearReceived);
    }
    
    tx.details.forEach(detail => {
      // Gas fee
      totalGasFee += detail.gasFee || 0;
      
      // Token transfers - сохраняем полную информацию
      if (detail.tokenTransfers && detail.tokenTransfers.length > 0) {
        detail.tokenTransfers.forEach(t => {
          tokensInvolved.push({
            name: t.token,
            contract: t.contract,
            amount: t.amount, // raw amount
            direction: t.direction || 'unknown', // 'in' или 'out'
          });
        });
      }
    });
    
    // Показываем сводку для swap/сложных операций
    if (tx.txCount > 1 && (totalNearSpent > 0 || totalNearReceived > 0 || tokensInvolved.length > 0)) {
      detailsMessage += `━━━━━━━━━━━━━━━━━━\n`;
      
      // Если это объединенный swap (есть и NEAR и токены)
      if (totalNearSpent > 0 && tokensInvolved.length > 0) {
        detailsMessage += `💱 **SWAP ОПЕРАЦИЯ**\n`;
        detailsMessage += `━━━━━━━━━━━━━━━━━━\n`;
        
        const nearPrice = await getNearPrice().catch(() => null);
        
        // Разделяем токены на исходящие и входящие
        const tokensOut = tokensInvolved.filter(t => t.direction === 'out');
        const tokensIn = tokensInvolved.filter(t => t.direction === 'in');
        
        // ОТДАНО
        detailsMessage += `📤 **Отдано:**\n`;
        
        // Показываем NEAR если потрачен
        if (totalNearSpent > 0) {
          const nearUsd = nearPrice ? ` ($${(totalNearSpent * nearPrice).toFixed(2)})` : '';
          detailsMessage += `   ${totalNearSpent.toFixed(4)} NEAR${nearUsd}\n`;
        }
        
        // Показываем исходящие токены
        for (const token of tokensOut) {
          if (token.amount) {
            try {
              const decimals = getTokenDecimals(token.contract);
              const rawAmount = BigInt(String(token.amount).replace(/[^0-9]/g, ''));
              const normalizedAmount = Number(rawAmount) / Math.pow(10, decimals);
              
              let amountStr = formatTokenAmount(normalizedAmount);
              detailsMessage += `   ${amountStr} ${token.name}\n`;
            } catch (error) {
              console.error('[Token Format Error]', error.message);
              detailsMessage += `   ${token.name}\n`;
            }
          }
        }
        
        detailsMessage += '\n';
        
        // ПОЛУЧЕНО
        detailsMessage += `📥 **Получено:**\n`;
        
        // Показываем NEAR если получен
        if (totalNearReceived > 0) {
          const nearUsd = nearPrice ? ` ($${(totalNearReceived * nearPrice).toFixed(2)})` : '';
          detailsMessage += `   ${totalNearReceived.toFixed(4)} NEAR${nearUsd}\n`;
        }
        
        // Показываем входящие токены
        let hasIncomingWithAmount = false;
        if (tokensIn.length > 0) {
          for (const token of tokensIn) {
            if (token.amount) {
              try {
                const decimals = getTokenDecimals(token.contract);
                const rawAmount = BigInt(String(token.amount).replace(/[^0-9]/g, ''));
                const normalizedAmount = Number(rawAmount) / Math.pow(10, decimals);
                
                let amountStr = formatTokenAmount(normalizedAmount);
                detailsMessage += `   ${amountStr} ${token.name}\n`;
                hasIncomingWithAmount = true;
              } catch (error) {
                console.error('[Token Format Error]', error.message);
                detailsMessage += `   ${token.name}\n`;
              }
            } else {
              detailsMessage += `   ${token.name}\n`;
            }
          }
        } else {
          // Если нет входящих токенов, показываем имена из всех токенов
          const allTokenNames = new Set(tokensInvolved.map(t => t.name));
          if (allTokenNames.size > 0) {
            detailsMessage += `   ${Array.from(allTokenNames).join(', ')}\n`;
          }
        }
        
        // Если не удалось получить точное количество, добавляем примечание
        if (!hasIncomingWithAmount && tokensInvolved.length > 0) {
          detailsMessage += `   _Точное количество см. в деталях ниже_\n`;
        }
        
        detailsMessage += '\n';
        const gasFeeUsd = nearPrice ? ` ($${(totalGasFee * nearPrice).toFixed(3)})` : '';
        detailsMessage += `⛽ **Gas:** ${totalGasFee.toFixed(6)} NEAR${gasFeeUsd}\n`;
      }
      // Обычная сводка
      else {
        detailsMessage += `**Сводка операции:**\n\n`;
        
        if (totalNearSpent > 0) {
          detailsMessage += `📤 Потрачено: ${totalNearSpent.toFixed(4)} NEAR\n`;
        }
        if (totalNearReceived > 0) {
          detailsMessage += `📥 Получено: ${totalNearReceived.toFixed(4)} NEAR\n`;
        }
        if (tokensInvolved.length > 0) {
          const tokensList = tokensInvolved.map(t => t.name).join(', ');
          detailsMessage += `🪙 Токены: ${tokensList}\n`;
        }
        if (totalGasFee > 0) {
          detailsMessage += `⛽ Gas fee: ${totalGasFee.toFixed(6)} NEAR\n`;
        }
        detailsMessage += '\n';
      }
    }
    
    detailsMessage += `━━━━━━━━━━━━━━━━━━\n`;
    detailsMessage += `🔗 **Transaction Hash:**\n\`${tx.txHashes[0]}\`\n\n`;
    detailsMessage += `[Посмотреть детали на Nearblocks](https://nearblocks.io/txns/${tx.txHashes[0]})`;
    
    // Отправляем детали
    await ctx.answerCbQuery('✅');
    await ctx.replyWithMarkdown(detailsMessage, { disable_web_page_preview: true });
    
  } catch (error) {
    console.error('Ошибка в tx_ callback:', error.message);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

function formatBalanceComparison(balance24h, currentNear, currentHot) {
  const fmt = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!balance24h) {
    return '📊 *Динамика за 24ч*\nДанных пока нет. Используйте /balance для накопления истории.';
  }
  const dNear = currentNear - balance24h.nearAmount;
  const dHot = currentHot - balance24h.hotAmount;
  const nearSign = dNear >= 0 ? '+' : '';
  const hotSign = dHot >= 0 ? '+' : '';
  return (
    '📊 *Динамика за 24ч*\n' +
    `NEAR: ${fmt(balance24h.nearAmount)} → ${fmt(currentNear)} (${nearSign}${fmt(dNear)})\n` +
    `HOT: ${fmt(balance24h.hotAmount)} → ${fmt(currentHot)} (${hotSign}${fmt(dHot)})`
  );
}

bot.command('pulse', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];

  if (!address) {
    await ctx.reply('📍 Укажите адрес. Пример: /pulse vlad.near');
    return;
  }

  try {
    const loadingMsg = await ctx.reply('⏳ Собираю данные и анализирую...');

    const telegramId = ctx.from?.id;
    const [transactions, nearData, stakingBalance, hotBalance, balance24h] = await Promise.all([
      getTransactionHistory(address),
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
      telegramId ? Promise.resolve(getBalance24hAgo(telegramId, address)) : Promise.resolve(null),
    ]);

    const report = await generatePulseReport(transactions, address);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    const currentNear = nearData.near + stakingBalance;
    const comparisonBlock = formatBalanceComparison(balance24h, currentNear, hotBalance);

    const message =
      `${APPLE_STYLE_HEADER}\n` +
      `📈 **Pulse |** \`${address}\`\n` +
      '━━━━━━━━━━━━━━━━━━\n\n' +
      report +
      '\n\n---\n' + comparisonBlock;

    await ctx.replyWithMarkdown(message);

    if (telegramId) updateUserAddress(telegramId, address);
  } catch (error) {
    console.error('Ошибка /pulse:', error.message);
    await ctx.reply('❌ ' + (error.message || 'Не удалось сформировать отчёт. Попробуйте позже.'));
  }
});

// /app — Открыть Mini App
bot.command('app', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];
  const telegramId = ctx.from?.id;
  const user = telegramId ? getUser(telegramId) : null;
  const addr = address || user?.nearAddress;

  if (!addr) {
    return ctx.reply('📍 Укажите адрес: /app vlad.near\nИли сначала используйте /balance для сохранения адреса.');
  }

  const webappUrl = process.env.WEBAPP_URL || 'https://nearpulse.vercel.app';
  const url = `${webappUrl}?address=${encodeURIComponent(addr)}`;

  await ctx.reply(
    `${APPLE_STYLE_HEADER}\n` +
    `📊 **NearPulse Analytics**\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Откройте приложение для детальной аналитики кошелька \`${addr}\``,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📊 Открыть NearPulse', url)],
      ]),
    }
  );
});

bot.command('settings', (ctx) => {
  const userId = ctx.from?.id;
  const user = userId ? getUser(userId) : null;
  const hotNotifyEnabled = user?.hotNotifyEnabled ?? false;
  const hasAddress = !!user?.nearAddress;
  const notifyLabel = hotNotifyEnabled ? '🔔 Вкл.' : '🔕 Выкл.';

  let hint = 'Нажмите кнопку, чтобы включить напоминание за 15 минут до заполнения хранилища.';
  if (!hasAddress && !hotNotifyEnabled) {
    hint = 'Сначала укажите адрес: /balance ваш_адрес.near — тогда сможете включить уведомления.';
  }

  const message =
    `${APPLE_STYLE_HEADER}\n` +
    '⚙️ **Настройки**\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🔔 **Уведомление за 15 мин до клейма HOT** — ' + notifyLabel + '\n\n' +
    hint;

  const keyboard = hasAddress
    ? Markup.inlineKeyboard([
        [Markup.button.callback(hotNotifyEnabled ? '🔕 Отключить уведомления' : '🔔 Включить уведомления за 15 мин', 'hot_notify_toggle')],
      ])
    : Markup.inlineKeyboard([]);

  ctx.replyWithMarkdown(message, keyboard);
});

bot.command('test_notify', async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  try {
    await ctx.reply('🔥 Тестовое уведомление: Ваше хранилище почти полно! Пора забирать HOT.');
    console.log(`[Test] Тестовое уведомление отправлено ${userId}`);
  } catch (error) {
    await ctx.reply('❌ Ошибка отправки');
  }
});

bot.action('hot_notify_toggle', (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return ctx.answerCbQuery('Ошибка');

  const user = getUser(userId);
  if (!user?.nearAddress) {
    return ctx.answerCbQuery('Сначала укажите адрес: /balance ваш_адрес.near');
  }

  const newState = !user.hotNotifyEnabled;
  setHotNotify(userId, newState);

  ctx.answerCbQuery(newState ? 'Уведомления включены' : 'Уведомления отключены');

  const notifyLabel = newState ? '🔔 Вкл.' : '🔕 Выкл.';
  const message =
    `${APPLE_STYLE_HEADER}\n` +
    '⚙️ **Настройки**\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🔔 **Уведомление за 15 мин до клейма HOT** — ' + notifyLabel + '\n\n' +
    (newState
      ? `Мониторинг адреса \`${user.nearAddress}\`. Вы получите напоминание за 15 минут до заполнения хранилища.`
      : 'Нажмите кнопку ниже, чтобы снова включить.');

  ctx.editMessageText(message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(newState ? '🔕 Отключить уведомления' : '🔔 Включить уведомления за 15 мин', 'hot_notify_toggle')],
    ]),
  });
});

const NOTIFY_THRESHOLD_MINUTES = 15;

async function runHotClaimMonitor() {
  try {
    const users = getUsersForMonitoring();
    if (users.length === 0) return;

    const now = Math.floor(Date.now() / 1000);

    for (const { telegramId, nearAddress, lastHotNotifyAt } of users) {
      if (lastHotNotifyAt && now - lastHotNotifyAt < NOTIFY_COOLDOWN_SEC) continue;

      try {
        const status = await getHotClaimStatus(nearAddress);
        if (!status) continue;

        const totalMinutes = status.hoursUntilClaim * 60 + status.minutesUntilClaim;

        if (status.readyToClaim || totalMinutes < NOTIFY_THRESHOLD_MINUTES) {
          await bot.telegram.sendMessage(
            telegramId,
            status.readyToClaim
              ? '🔥 Пора забирать HOT! Хранилище заполнено.'
              : `🔥 Ваше хранилище почти полно! До клейма ~${totalMinutes} мин. Пора забирать HOT.`
          );
          updateLastHotNotify(telegramId);
          console.log(`[Monitor] Уведомление отправлено ${telegramId} (${nearAddress}), осталось ${totalMinutes} мин`);
        }
      } catch (err) {
        console.error('[Monitor] Ошибка для', nearAddress, err.message);
      }
    }
  } catch (error) {
    console.error('[Monitor] Ошибка:', error.message);
  }
}

async function main() {
  try {
    getDb();
    await bot.launch();
    console.log('✅ NearPulse bot started successfully');

    cron.schedule('*/15 * * * *', runHotClaimMonitor);
    console.log('⏰ HOT Claim Monitor: каждые 15 мин (уведомление за 15 мин до клейма)');

    setTimeout(runHotClaimMonitor, 10000);
  } catch (error) {
    console.error('Ошибка запуска бота:', error.message);
    process.exit(1);
  }
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

main();