require('dotenv/config');
const cron = require('node-cron');
const { Telegraf, Markup } = require('telegraf');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
require('dayjs/locale/ru');

dayjs.extend(relativeTime);
dayjs.locale('ru');
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
const APPLE_STYLE_HEADER = ' **NearPulse | Finance**\n';

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
    '📜 /transactions <адрес> — История последних 5 транзакций.\n' +
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

    if (!Array.isArray(txns) || txns.length === 0) {
      await ctx.reply('📭 История транзакций пуста или недоступна.');
      return;
    }

    const formatNum = (n) =>
      n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatUsd = (nearAmount) => {
      if (!nearPrice || !nearAmount || nearAmount < 0.01) return '';
      const usd = nearAmount * nearPrice;
      return ` (~$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    };

    // Группируем по transaction_hash и берём только последние 5
    const groupedTxns = {};
    txns.forEach(tx => {
      const hash = tx.transaction_hash;
      if (!groupedTxns[hash]) {
        groupedTxns[hash] = [];
      }
      groupedTxns[hash].push(tx);
    });

    const uniqueTxns = Object.entries(groupedTxns)
      .map(([hash, group]) => ({
        hash,
        timestamp: group[0].block_timestamp,
        transactions: group
      }))
      .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
      .slice(0, 5); // Только последние 5

    let message = `${APPLE_STYLE_HEADER}\n` +
                  `📜 **Последние транзакции**\n` +
                  `👤 **Аккаунт:** \`${address}\`\n` +
                  '━━━━━━━━━━━━━━━━━━\n\n';

    uniqueTxns.forEach((txGroup, index) => {
      const group = txGroup.transactions;
      const relevantTxs = group.filter(tx => 
        tx.receiver_account_id !== 'system' && 
        tx.predecessor_account_id !== 'system'
      );

      if (relevantTxs.length === 0) return;

      const firstTx = relevantTxs[0];
      const timestamp = parseInt(firstTx.block_timestamp) / 1000000; // nanoseconds to ms
      const timeAgo = dayjs(timestamp).fromNow();

      // Определяем тип транзакции
      const contracts = relevantTxs.map(tx => tx.receiver_account_id);
      let totalNear = 0;
      
      relevantTxs.forEach(tx => {
        const deposit = tx.actions_agg?.deposit ? parseFloat(tx.actions_agg.deposit) / 1e24 : 0;
        if (tx.predecessor_account_id === address) {
          totalNear += deposit;
        } else if (tx.receiver_account_id === address) {
          totalNear -= deposit; // входящий
        }
      });

      const hasHot = contracts.some(c => c.includes('hot.tg') || c === 'game.hot.tg');
      const hasMoon = contracts.some(c => c.includes('harvest-moon'));
      const hasRef = contracts.some(c => c.includes('ref-finance'));
      const hasRhea = contracts.some(c => c.includes('rhea'));
      const hasTokenTransfer = contracts.some(c => 
        c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking')
      );

      let icon = '';
      let description = '';
      let showAmount = false;
      let displayAmount = Math.abs(totalNear);

      // 🔥 HOT Claim (специальная иконка!)
      if (hasHot) {
        icon = '🔥';
        description = 'Claim HOT';
        showAmount = false;
      }
      // 🎁 Другие claims
      else if (hasMoon) {
        icon = '🎁';
        description = 'Claim MOON';
        showAmount = false;
      }
      // 🔄 Swap
      else if ((hasRef || hasRhea) && relevantTxs.length > 1) {
        icon = '🔄';
        description = hasRef ? 'Swap (Ref Finance)' : 'Swap (RHEA)';
        showAmount = displayAmount > 0.01;
      }
      // 📥 📤 NEAR Transfer
      else if (displayAmount > 0.01 && !hasTokenTransfer) {
        const isOutgoing = totalNear > 0;
        icon = isOutgoing ? '📤' : '📥';
        const otherParty = isOutgoing ? firstTx.receiver_account_id : firstTx.predecessor_account_id;
        
        // Сокращаем длинные адреса
        let shortAddress = otherParty;
        if (otherParty.length > 20) {
          shortAddress = otherParty.substring(0, 17) + '...';
        }
        
        description = isOutgoing ? `Отправлено → ${shortAddress}` : `Получено ← ${shortAddress}`;
        showAmount = true;
      }
      // 🪙 Token Transfer
      else if (hasTokenTransfer) {
        const tokenContract = contracts.find(c => 
          c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking')
        );
        
        let tokenName = 'TOKEN';
        if (tokenContract) {
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
        }

        const isOutgoing = firstTx.predecessor_account_id === address;
        icon = isOutgoing ? '📤' : '📥';
        description = isOutgoing ? `Отправлено ${tokenName}` : `Получено ${tokenName}`;
        showAmount = false;
      }
      // 📝 Contract Call
      else {
        icon = '📝';
        description = 'Вызов контракта';
        showAmount = displayAmount > 0.01;
      }

      // Формируем вывод (2-3 строки)
      message += `${icon} **${description}**\n`;
      
      if (showAmount) {
        message += `💰 **${formatNum(displayAmount)} NEAR**${formatUsd(displayAmount)}\n`;
      }
      
      message += `🕒 ${timeAgo}\n`;

      // Добавляем разделитель между транзакциями
      if (index < uniqueTxns.length - 1) {
        message += '\n';
      }
    });

    message += '\n━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message);

  } catch (error) {
    console.error('Ошибка в /transactions:', error.message);
    await ctx.reply('❌ Не удалось загрузить транзакции. Попробуйте позже.');
  }
});

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

// Функция для форматирования сравнения балансов (для /pulse)
function formatBalanceComparison(balance24h, currentNear, currentHot) {
  if (!balance24h) return '';
  const fmt = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

async function launchBotInBackground() {
  const maxRetries = 10;
  const baseDelay = 5000; // 5 секунд между попытками

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Принудительно сбрасываем webhook перед запуском
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await new Promise(r => setTimeout(r, 1000));
      await bot.launch({ dropPendingUpdates: true });
      console.log(`✅ NearPulse bot started successfully (attempt ${attempt})`);

      cron.schedule('*/15 * * * *', runHotClaimMonitor);
      console.log('⏰ HOT Claim Monitor: каждые 15 мин');
      setTimeout(runHotClaimMonitor, 10000);
      return;
    } catch (error) {
      if (error.message?.includes('409') && attempt < maxRetries) {
        const delay = baseDelay * attempt;
        console.warn(`⚠️ Bot conflict (409), retry ${attempt}/${maxRetries} in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(`❌ Bot launch failed after ${attempt} attempts:`, error.message);
        return; // Не крашим процесс — API продолжает работать
      }
    }
  }
}

async function main() {
  try {
    getDb();
  } catch (e) {
    console.error('DB init error (non-fatal):', e.message);
  }

  // API теперь на Render (Python api.py) — здесь только бот
  await launchBotInBackground();
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (keeping alive):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (keeping alive):', err.message || err);
});
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

main().catch(err => console.error('Main error:', err.message));
