require('dotenv/config');
const cron = require('node-cron');
const { Telegraf, Markup } = require('telegraf');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
require('dayjs/locale/ru');
dayjs.extend(relativeTime);
dayjs.locale('ru');

const {
  getBalance, getTokenBalance, getTokensWithPrices,
  getStakingBalance, getTransactionHistory, getTransactionsForDisplay,
  getHotClaimStatus, getNearPrice, TOKEN_DECIMALS_MAP,
} = require('./services/nearService');
const { generatePulseReport } = require('./services/aiService');
const {
  getDb, updateUserAddress, setHotNotify, getUser,
  getUsersForMonitoring, updateLastHotNotify, NOTIFY_COOLDOWN_SEC,
  saveBalanceSnapshot, getBalance24hAgo,
} = require('./config/database');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('Ошибка: TELEGRAM_BOT_TOKEN не задан'); process.exit(1); }

const bot = new Telegraf(token);

const HEADER = '🔥 *NearPulse*\n';

// ─── Валидация NEAR адреса ─────────────────────────────────────────────────
function isValidNearAddress(addr) {
  if (!addr) return false;
  const trimmed = addr.trim().toLowerCase();
  // Форматы: ***.near, ***.tg, ***.aurora, hex (64 символа)
  if (/^[a-z0-9_-]+\.(near|tg|aurora|sweat|kaiching|page)$/.test(trimmed)) return true;
  if (/^[a-f0-9]{64}$/.test(trimmed)) return true;
  return false;
}

// ─── Главное меню (кнопки) ─────────────────────────────────────────────────
function mainMenu() {
  return Markup.keyboard([
    ['💰 Баланс', '📊 Аналитика'],
    ['📜 Транзакции', '📈 Pulse'],
    ['🌐 Mini App', '⚙️ Настройки'],
  ]).resize();
}

// ─── Приветствие с запросом адреса ────────────────────────────────────────
async function askForAddress(ctx) {
  await ctx.replyWithMarkdown(
    `${HEADER}\n` +
    'Привет! Я твой персональный аналитик NEAR.\n\n' +
    'Отправь мне свой NEAR адрес чтобы начать:\n\n' +
    '`***.near` или `***.tg`',
    Markup.removeKeyboard()
  );
}

// ─── Показать главное меню ─────────────────────────────────────────────────
async function showMainMenu(ctx, address) {
  await ctx.replyWithMarkdown(
    `${HEADER}\n` +
    `👤 *Кошелёк:* \`${address}\`\n\n` +
    'Выбери действие:',
    mainMenu()
  );
}

// ─── /start ────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const userId = ctx.from?.id;
  const user = userId ? getUser(userId) : null;

  // Если адрес уже сохранён — сразу меню
  if (user?.nearAddress) {
    return showMainMenu(ctx, user.nearAddress);
  }

  // Иначе просим адрес
  await askForAddress(ctx);
});

// ─── /help ─────────────────────────────────────────────────────────────────
bot.help((ctx) => {
  ctx.replyWithMarkdown(
    `${HEADER}\n` +
    '📋 *Доступные кнопки:*\n\n' +
    '💰 *Баланс* — NEAR, стейкинг, HOT и токены\n' +
    '📊 *Аналитика* — изменения за 24ч, распределение\n' +
    '📜 *Транзакции* — последние 5 операций\n' +
    '📈 *Pulse* — AI-анализ активности\n' +
    '🌐 *Mini App* — открыть веб-приложение\n' +
    '⚙️ *Настройки* — уведомления HOT\n\n' +
    'Чтобы сменить кошелёк — просто отправь новый адрес.'
  );
});

// ─── Обработка текстовых сообщений (адрес + кнопки меню) ──────────────────
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from?.id;
  const user = userId ? getUser(userId) : null;

  // ── Кнопки меню ───────────────────────────────────────────────────────
  if (text === '💰 Баланс')      return handleBalance(ctx, user);
  if (text === '📊 Аналитика')   return handleAnalytics(ctx, user);
  if (text === '📜 Транзакции')  return handleTransactions(ctx, user);
  if (text === '📈 Pulse')       return handlePulse(ctx, user);
  if (text === '🌐 Mini App')    return handleApp(ctx, user);
  if (text === '⚙️ Настройки')   return handleSettings(ctx, user);

  // ── Проверяем — может это NEAR адрес? ────────────────────────────────
  if (isValidNearAddress(text)) {
    const address = text.trim().toLowerCase();
    if (userId) {
      updateUserAddress(userId, address);
      saveBalanceSnapshot(userId, address, 0, 0);
    }
    await ctx.replyWithMarkdown(
      `✅ *Адрес сохранён!*\n\`${address}\``,
    );
    return showMainMenu(ctx, address);
  }

  // ── Непонятное сообщение ──────────────────────────────────────────────
  if (user?.nearAddress) {
    await ctx.reply('Используй кнопки меню 👇', mainMenu());
  } else {
    await askForAddress(ctx);
  }
});

// ─── Форматирование ────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = (amount, price) => price ? ` (~$${(amount * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';

function fmtTokenAmount(amount) {
  if (amount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
  if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
  if (amount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
  return fmt(amount);
}

// ─── Проверка что адрес есть ───────────────────────────────────────────────
async function requireAddress(ctx, user) {
  if (!user?.nearAddress) {
    await askForAddress(ctx);
    return false;
  }
  return true;
}

// ─── 💰 Баланс ────────────────────────────────────────────────────────────
async function handleBalance(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;

  const loadingMsg = await ctx.reply('⏳ Сканирую блокчейн...');
  try {
    const [nearData, stakingBalance, hotBalance, claimStatus, nearPrice, categorizedTokens] = await Promise.all([
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
      getHotClaimStatus(address),
      getNearPrice().catch(() => null),
      getTokensWithPrices(address, 1),
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    const totalValue = nearData.near + stakingBalance;

    let claimLine = '';
    if (claimStatus) {
      claimLine = claimStatus.readyToClaim
        ? '\n🔥 *Пора забирать HOT!*\n'
        : `\n⏱ *До клейма:* ${claimStatus.hoursUntilClaim}ч ${claimStatus.minutesUntilClaim}м\n`;
    }

    let majorTokensSection = '';
    if (categorizedTokens.major.length > 0) {
      majorTokensSection = '\n\n💎 *Основные токены:*\n';
      categorizedTokens.major.forEach(t => {
        majorTokensSection += `• ${t.symbol}: ${fmtTokenAmount(t.amount)}${t.price > 0 ? ` (~$${fmt(t.usdValue)})` : ''}\n`;
      });
    }

    let filteredTokensSection = '';
    if (categorizedTokens.filtered.length > 0) {
      filteredTokensSection = '\n💰 *Другие токены:*\n';
      categorizedTokens.filtered.forEach(t => {
        filteredTokensSection += `• ${t.symbol}: ${fmtTokenAmount(t.amount)}${t.price > 0 ? ` (~$${fmt(t.usdValue)})` : ''}\n`;
      });
    }

    let hiddenInfo = '';
    if (categorizedTokens.hidden.length > 0) {
      hiddenInfo = `\n🔻 _${categorizedTokens.hidden.length} токенов скрыто (< $1)_`;
    }

    const message =
      `${HEADER}\n` +
      `👤 *Аккаунт:* \`${address}\`\n` +
      '━━━━━━━━━━━━━━━━━━\n' +
      `📊 *Общая ценность:* ${fmt(totalValue)} NEAR${fmtUsd(totalValue, nearPrice)}\n` +
      '---\n' +
      `💰 *Доступно:* ${fmt(nearData.near)} NEAR${fmtUsd(nearData.near, nearPrice)}\n` +
      `🔒 *Стейкинг:* ${fmt(stakingBalance)} NEAR${fmtUsd(stakingBalance, nearPrice)}\n` +
      `🔥 *HOT:* ${fmt(hotBalance)}` +
      claimLine +
      majorTokensSection +
      filteredTokensSection +
      hiddenInfo +
      '\n━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message, mainMenu());

    if (ctx.from?.id) {
      saveBalanceSnapshot(ctx.from.id, address, nearData.near + stakingBalance, hotBalance);
    }
  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    console.error('[balance]', error.message);
    await ctx.reply('❌ Не удалось получить данные. Проверь адрес в настройках.', mainMenu());
  }
}

// ─── 📊 Аналитика ─────────────────────────────────────────────────────────
async function handleAnalytics(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;

  const loadingMsg = await ctx.reply('⏳ Анализирую данные...');
  try {
    const [nearData, stakingBalance, hotBalance, nearPrice, categorizedTokens, txns] = await Promise.all([
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
      getNearPrice().catch(() => null),
      getTokensWithPrices(address, 1),
      getTransactionHistory(address).catch(() => []),
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    const totalNear = nearData.near + stakingBalance;
    const totalUsd = nearPrice ? totalNear * nearPrice : 0;

    const balance24h = ctx.from?.id ? getBalance24hAgo(ctx.from.id) : null;

    let changeSection = '';
    if (balance24h) {
      const nearChange = totalNear - balance24h.nearBalance;
      const pct = balance24h.nearBalance > 0 ? (nearChange / balance24h.nearBalance * 100) : 0;
      const sign = nearChange >= 0 ? '+' : '';
      const icon = nearChange >= 0 ? '📈' : '📉';
      changeSection =
        '\n📊 *Изменение за 24ч:*\n' +
        `${icon} NEAR: ${sign}${fmt(nearChange)} (${sign}${pct.toFixed(2)}%)${fmtUsd(nearChange, nearPrice)}\n`;
    } else {
      changeSection = '\n📊 *Изменение за 24ч:*\n_Данных пока нет_\n';
    }

    const totalTokensUsd = [...categorizedTokens.major, ...categorizedTokens.filtered]
      .reduce((sum, t) => sum + t.usdValue, 0);
    const totalPortfolio = totalUsd + totalTokensUsd;
    const nearPct = totalPortfolio > 0 ? (totalUsd / totalPortfolio * 100) : 0;
    const tokensPct = totalPortfolio > 0 ? (totalTokensUsd / totalPortfolio * 100) : 0;
    const bar = (pct) => '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

    const distributionSection =
      '\n💼 *Распределение:*\n' +
      `💎 NEAR: ${nearPct.toFixed(1)}%\n${bar(nearPct)} $${fmt(totalUsd)}\n` +
      `🪙 Токены: ${tokensPct.toFixed(1)}%\n${bar(tokensPct)} $${fmt(totalTokensUsd)}\n`;

    const last24h = txns.filter(tx => {
      const ts = parseInt(tx.block_timestamp) / 1000000;
      return ts > Date.now() - 24 * 60 * 60 * 1000;
    });

    const message =
      `${HEADER}\n` +
      `📊 *Аналитика*\n` +
      `👤 \`${address}\`\n` +
      '━━━━━━━━━━━━━━━━━━\n' +
      `💰 *Портфель:* $${fmt(totalPortfolio)}\n` +
      changeSection +
      distributionSection +
      `\n📈 *Активность (24ч):* ${last24h.length} транзакций\n` +
      '━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message, mainMenu());
  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    console.error('[analytics]', error.message);
    await ctx.reply('❌ Ошибка загрузки аналитики.', mainMenu());
  }
}

// ─── 📜 Транзакции ────────────────────────────────────────────────────────
async function handleTransactions(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;

  const loadingMsg = await ctx.reply('⏳ Загружаю транзакции...');
  try {
    const nearPrice = await getNearPrice().catch(() => null);
    const analyzed = await getTransactionsForDisplay(address, nearPrice, 10);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    if (!analyzed || analyzed.length === 0) {
      return ctx.reply('📭 История транзакций пуста.', mainMenu());
    }

    const items = analyzed.slice(0, 5);
    let message = `${HEADER}\n📜 *Последние транзакции*\n👤 \`${address}\`\n━━━━━━━━━━━━━━━━━━\n\n`;

    items.forEach((tx, index) => {
      const timeAgo = dayjs(tx.timestamp).fromNow();
      message += `${tx.icon} *${tx.description}*\n`;
      if (tx.amount > 0.01) {
        message += `💰 *${fmt(tx.amount)} NEAR*${fmtUsd(tx.amount, nearPrice)}\n`;
      }
      message += `🕒 ${timeAgo}\n`;
      if (index < items.length - 1) message += '\n';
    });

    message += '\n━━━━━━━━━━━━━━━━━━';
    await ctx.replyWithMarkdown(message, mainMenu());
  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    console.error('[transactions]', error.message);
    await ctx.reply('❌ Ошибка загрузки транзакций.', mainMenu());
  }
}

// ─── 📈 Pulse (AI анализ) ─────────────────────────────────────────────────
async function handlePulse(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;

  const loadingMsg = await ctx.reply('⏳ Собираю данные и анализирую...');
  try {
    const [transactions, nearData, stakingBalance, hotBalance] = await Promise.all([
      getTransactionHistory(address),
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
    ]);

    const report = await generatePulseReport(transactions, address);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    const balance24h = ctx.from?.id ? getBalance24hAgo(ctx.from.id) : null;
    const currentNear = nearData.near + stakingBalance;
    const comparisonBlock = formatBalanceComparison(balance24h, currentNear, hotBalance);

    const message =
      `${HEADER}\n` +
      `📈 *Pulse* | \`${address}\`\n` +
      '━━━━━━━━━━━━━━━━━━\n\n' +
      report +
      (comparisonBlock ? '\n\n---\n' + comparisonBlock : '');

    await ctx.replyWithMarkdown(message, mainMenu());
    if (ctx.from?.id) updateUserAddress(ctx.from.id, address);
  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    console.error('[pulse]', error.message);
    await ctx.reply('❌ ' + (error.message || 'Не удалось сформировать отчёт.'), mainMenu());
  }
}

// ─── 🌐 Mini App ──────────────────────────────────────────────────────────
async function handleApp(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;

  const webappUrl = process.env.WEBAPP_URL || 'https://nearpulseapp.netlify.app';
  const url = `${webappUrl}?address=${encodeURIComponent(address)}`;

  await ctx.replyWithMarkdown(
    `${HEADER}\n` +
    `📊 *NearPulse Analytics*\n` +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    `Открой приложение для детальной аналитики кошелька \`${address}\``,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('📊 Открыть NearPulse', url)],
      ]),
    }
  );
}

// ─── ⚙️ Настройки ─────────────────────────────────────────────────────────
async function handleSettings(ctx, user) {
  const userId = ctx.from?.id;
  const hotNotifyEnabled = user?.hotNotifyEnabled ?? false;
  const hasAddress = !!user?.nearAddress;
  const notifyLabel = hotNotifyEnabled ? '🔔 Вкл.' : '🔕 Выкл.';

  let hint = 'Нажмите кнопку чтобы включить напоминание за 15 минут до клейма HOT.';
  if (!hasAddress) hint = 'Сначала отправь свой NEAR адрес чтобы включить уведомления.';

  const message =
    `${HEADER}\n` +
    '⚙️ *Настройки*\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    (hasAddress ? `👤 *Кошелёк:* \`${user.nearAddress}\`\n\n` : '') +
    `🔔 *HOT уведомление* — ${notifyLabel}\n\n` +
    hint;

  const keyboard = hasAddress
    ? Markup.inlineKeyboard([
        [Markup.button.callback(
          hotNotifyEnabled ? '🔕 Отключить уведомления' : '🔔 Включить уведомления',
          'hot_notify_toggle'
        )],
        [Markup.button.callback('🔄 Сменить кошелёк', 'change_address')],
      ])
    : Markup.inlineKeyboard([]);

  await ctx.replyWithMarkdown(message, keyboard);
}

// ─── Inline кнопки ────────────────────────────────────────────────────────
bot.action('hot_notify_toggle', (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return ctx.answerCbQuery('Ошибка');
  const user = getUser(userId);
  if (!user?.nearAddress) return ctx.answerCbQuery('Сначала укажи адрес');

  const newState = !user.hotNotifyEnabled;
  setHotNotify(userId, newState);
  ctx.answerCbQuery(newState ? '🔔 Уведомления включены' : '🔕 Уведомления отключены');

  const notifyLabel = newState ? '🔔 Вкл.' : '🔕 Выкл.';
  ctx.editMessageText(
    `${HEADER}\n⚙️ *Настройки*\n━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 *Кошелёк:* \`${user.nearAddress}\`\n\n` +
    `🔔 *HOT уведомление* — ${notifyLabel}\n\n` +
    (newState ? `Мониторинг включён. Уведомлю за 15 минут до клейма.` : 'Уведомления отключены.'),
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(newState ? '🔕 Отключить' : '🔔 Включить', 'hot_notify_toggle')],
        [Markup.button.callback('🔄 Сменить кошелёк', 'change_address')],
      ]),
    }
  );
});

bot.action('change_address', async (ctx) => {
  ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    'Отправь новый NEAR адрес:\n\n`***.near` или `***.tg`',
    Markup.removeKeyboard()
  );
});

// ─── Старые команды (совместимость) ───────────────────────────────────────
bot.command('balance',      (ctx) => handleBalance(ctx, getUser(ctx.from?.id)));
bot.command('analytics',    (ctx) => handleAnalytics(ctx, getUser(ctx.from?.id)));
bot.command('transactions', (ctx) => handleTransactions(ctx, getUser(ctx.from?.id)));
bot.command('pulse',        (ctx) => handlePulse(ctx, getUser(ctx.from?.id)));
bot.command('app',          (ctx) => handleApp(ctx, getUser(ctx.from?.id)));
bot.command('settings',     (ctx) => handleSettings(ctx, getUser(ctx.from?.id)));

bot.command('test_notify', async (ctx) => {
  await ctx.reply('🔥 Тест: Хранилище почти полно! Пора забирать HOT.');
});

// ─── Форматирование сравнения балансов ────────────────────────────────────
function formatBalanceComparison(balance24h, currentNear, currentHot) {
  if (!balance24h) return '';
  const prevNear = balance24h.nearAmount ?? balance24h.nearBalance ?? 0;
  const prevHot  = balance24h.hotAmount  ?? balance24h.hotBalance  ?? 0;
  const dNear = currentNear - prevNear;
  const dHot  = currentHot  - prevHot;
  const nearSign = dNear >= 0 ? '+' : '';
  const hotSign  = dHot  >= 0 ? '+' : '';
  return (
    '📊 *Динамика за 24ч*\n' +
    `NEAR: ${fmt(prevNear)} → ${fmt(currentNear)} (${nearSign}${fmt(dNear)})\n` +
    `HOT: ${fmt(prevHot)} → ${fmt(currentHot)} (${hotSign}${fmt(dHot)})`
  );
}

// ─── HOT Claim Monitor ────────────────────────────────────────────────────
const NOTIFY_THRESHOLD_MINUTES = 15;

async function runHotClaimMonitor() {
  try {
    const users = getUsersForMonitoring();
    if (!users.length) return;
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
              : `🔥 До клейма HOT ~${totalMinutes} мин. Не пропусти!`
          );
          updateLastHotNotify(telegramId);
        }
      } catch (err) {
        console.error('[Monitor]', nearAddress, err.message);
      }
    }
  } catch (error) {
    console.error('[Monitor]', error.message);
  }
}

// ─── Запуск ───────────────────────────────────────────────────────────────
async function launchBotInBackground() {
  const maxRetries = 10;
  const baseDelay  = 8000;
  const isRailway  = !!process.env.RAILWAY_ENVIRONMENT;

  if (isRailway) {
    console.log('⏳ [Railway] Ждём 15 сек...');
    await new Promise(r => setTimeout(r, 15000));
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await new Promise(r => setTimeout(r, 2000));
      await bot.launch({ dropPendingUpdates: true });
      console.log(`✅ NearPulse bot started (attempt ${attempt})`);
      cron.schedule('*/15 * * * *', runHotClaimMonitor);
      console.log('⏰ HOT Monitor: каждые 15 мин');
      setTimeout(runHotClaimMonitor, 10000);
      return;
    } catch (error) {
      if (error.message?.includes('409') && attempt < maxRetries) {
        const delay = baseDelay * attempt;
        console.warn(`⚠️ Conflict 409, retry ${attempt}/${maxRetries} in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(`❌ Bot launch failed:`, error.message);
        return;
      }
    }
  }
}

async function main() {
  try { getDb(); } catch (e) { console.error('DB init error:', e.message); }
  await launchBotInBackground();
}

process.on('uncaughtException',  (err) => console.error('Uncaught:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err?.message || err));
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

main().catch(err => console.error('Main error:', err.message));
