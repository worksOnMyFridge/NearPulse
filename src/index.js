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
  saveBalanceSnapshot, getBalance24hAgo, getBalanceHistory,
  addPriceAlert, removePriceAlert, getPriceAlerts,
  getAllUsersWithAlerts, deactivatePriceAlert,
} = require('./config/database');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('TELEGRAM_BOT_TOKEN не задан'); process.exit(1); }

const bot = new Telegraf(token);
const HEADER = '🔥 *NearPulse*\n';

// ─── Утилиты ──────────────────────────────────────────────────────────────
function isValidNearAddress(addr) {
  if (!addr) return false;
  const t = addr.trim().toLowerCase();
  if (/^[a-z0-9_-]+\.(near|tg|aurora|sweat|kaiching|page)$/.test(t)) return true;
  if (/^[a-f0-9]{64}$/.test(t)) return true;
  return false;
}

function isTxHash(str) {
  return /^[A-Za-z0-9_-]{43,44}$/.test(str.trim());
}

const fmt    = (n) => (n||0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = (amount, price) => price ? ` (~$${((amount||0) * price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '';

function fmtTokenAmount(amount) {
  if (amount >= 1e9) return (amount / 1e9).toFixed(2) + 'B';
  if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
  if (amount >= 1e3) return (amount / 1e3).toFixed(2) + 'K';
  return fmt(amount);
}

// ─── ASCII График баланса ─────────────────────────────────────────────────
function buildAsciiChart(history, label = 'NEAR') {
  if (!history || history.length < 2) return null;

  // Берём последние 14 снапшотов
  const points = history.slice(-14);
  const values = points.map(p => p.nearBalance || 0);
  const min    = Math.min(...values);
  const max    = Math.max(...values);
  const range  = max - min;

  if (range === 0) return null; // Баланс не менялся

  const HEIGHT = 5;
  const rows   = [];

  for (let row = HEIGHT; row >= 0; row--) {
    let line = '';
    const threshold = min + (range * row) / HEIGHT;
    for (let i = 0; i < points.length; i++) {
      const val = values[i];
      if (val >= threshold) {
        line += i === points.length - 1 ? '█' : '▓';
      } else {
        line += '░';
      }
    }
    if (row === HEIGHT) line += ` ${fmt(max)}`;
    if (row === 0)      line += ` ${fmt(min)}`;
    rows.push(line);
  }

  const change    = values[values.length - 1] - values[0];
  const changePct = values[0] > 0 ? (change / values[0] * 100) : 0;
  const sign      = change >= 0 ? '+' : '';
  const trend     = change >= 0 ? '📈' : '📉';

  return (
    `📊 *График ${label} (${points.length} точек)*\n` +
    '```\n' + rows.join('\n') + '\n```\n' +
    `${trend} ${sign}${fmt(change)} NEAR (${sign}${changePct.toFixed(1)}%)`
  );
}

// ─── Меню ─────────────────────────────────────────────────────────────────
function mainMenu() {
  return Markup.keyboard([
    ['💰 Баланс',      '📊 Аналитика'],
    ['📜 Транзакции',  '📈 Pulse'],
    ['📉 График',      '🌐 Mini App'],
    ['⚙️ Настройки'],
  ]).resize();
}

async function askForAddress(ctx) {
  await ctx.replyWithMarkdown(
    `${HEADER}\nПривет! Я твой персональный аналитик NEAR.\n\n` +
    'Отправь мне свой NEAR адрес чтобы начать:\n\n' +
    '`***.near` или `***.tg`',
    Markup.removeKeyboard()
  );
}

async function showMainMenu(ctx, address) {
  await ctx.replyWithMarkdown(
    `${HEADER}\n👤 *Кошелёк:* \`${address}\`\n\nВыбери действие:`,
    mainMenu()
  );
}

async function requireAddress(ctx, user) {
  if (!user?.nearAddress) { await askForAddress(ctx); return false; }
  return true;
}

// ─── /start ───────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const user = getUser(ctx.from?.id);
  if (user?.nearAddress) return showMainMenu(ctx, user.nearAddress);
  await askForAddress(ctx);
});

bot.help((ctx) => {
  ctx.replyWithMarkdown(
    `${HEADER}\n📋 *Кнопки меню:*\n\n` +
    '💰 *Баланс* — NEAR, стейкинг, HOT и токены\n' +
    '📊 *Аналитика* — изменения за 24ч\n' +
    '📜 *Транзакции* — последние операции\n' +
    '📈 *Pulse* — AI-анализ активности\n' +
    '📉 *График* — динамика баланса\n' +
    '🌐 *Mini App* — полное веб-приложение\n' +
    '⚙️ *Настройки* — уведомления и алерты\n\n' +
    'Отправь хэш транзакции чтобы её расшифровать.\n' +
    'Чтобы сменить кошелёк — отправь новый адрес.'
  );
});

// ─── Текстовые сообщения ──────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const text   = ctx.message.text.trim();
  const userId = ctx.from?.id;
  const user   = userId ? getUser(userId) : null;

  // Кнопки меню
  if (text === '💰 Баланс')     return handleBalance(ctx, user);
  if (text === '📊 Аналитика')  return handleAnalytics(ctx, user);
  if (text === '📜 Транзакции') return handleTransactions(ctx, user);
  if (text === '📈 Pulse')      return handlePulse(ctx, user);
  if (text === '📉 График')     return handleChart(ctx, user);
  if (text === '🌐 Mini App')   return handleApp(ctx, user);
  if (text === '⚙️ Настройки')  return handleSettings(ctx, user);

  // Хэш транзакции
  if (isTxHash(text)) return handleTxLookup(ctx, text);

  // NEAR адрес
  if (isValidNearAddress(text)) {
    const address = text.trim().toLowerCase();
    if (userId) { updateUserAddress(userId, address); saveBalanceSnapshot(userId, address, 0, 0); }
    await ctx.replyWithMarkdown(`✅ *Адрес сохранён!*\n\`${address}\``);
    return showMainMenu(ctx, address);
  }

  // Команда /alert — парсим из текста
  if (text.startsWith('/alert') || text.toLowerCase().startsWith('алерт')) {
    return handleAlertCommand(ctx, text, user);
  }

  if (user?.nearAddress) await ctx.reply('Используй кнопки меню 👇', mainMenu());
  else await askForAddress(ctx);
});

// ─── 💰 Баланс ────────────────────────────────────────────────────────────
async function handleBalance(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;
  const loading = await ctx.reply('⏳ Сканирую блокчейн...');
  try {
    const [nearData, stakingBalance, hotBalance, claimStatus, nearPrice, categorizedTokens] = await Promise.all([
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
      getHotClaimStatus(address),
      getNearPrice().catch(() => null),
      getTokensWithPrices(address, 1),
    ]);
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);

    const totalValue = nearData.near + stakingBalance;
    let claimLine = '';
    if (claimStatus) {
      claimLine = claimStatus.readyToClaim
        ? '\n🔥 *Пора забирать HOT!*\n'
        : `\n⏱ *До клейма:* ${claimStatus.hoursUntilClaim}ч ${claimStatus.minutesUntilClaim}м\n`;
    }
    let majorTokens = '';
    if (categorizedTokens.major?.length > 0) {
      majorTokens = '\n\n💎 *Основные токены:*\n';
      categorizedTokens.major.forEach(t => {
        majorTokens += `• ${t.symbol}: ${fmtTokenAmount(t.amount)}${t.price > 0 ? ` (~$${fmt(t.usdValue)})` : ''}\n`;
      });
    }
    const message =
      `${HEADER}\n👤 *Аккаунт:* \`${address}\`\n━━━━━━━━━━━━━━━━━━\n` +
      `📊 *Общая:* ${fmt(totalValue)} NEAR${fmtUsd(totalValue, nearPrice)}\n` +
      `💰 *Доступно:* ${fmt(nearData.near)} NEAR\n` +
      `🔒 *Стейкинг:* ${fmt(stakingBalance)} NEAR\n` +
      `🔥 *HOT:* ${fmt(hotBalance)}` +
      claimLine + majorTokens + '\n━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message, mainMenu());
    if (userId) saveBalanceSnapshot(ctx.from.id, address, nearData.near + stakingBalance, hotBalance);
  } catch (e) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    await ctx.reply('❌ Не удалось получить данные.', mainMenu());
  }
}

// ─── 📊 Аналитика ─────────────────────────────────────────────────────────
async function handleAnalytics(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;
  const loading = await ctx.reply('⏳ Анализирую...');
  try {
    const [nearData, stakingBalance, hotBalance, nearPrice, txns] = await Promise.all([
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
      getNearPrice().catch(() => null),
      getTransactionHistory(address).catch(() => []),
    ]);
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);

    const totalNear  = nearData.near + stakingBalance;
    const balance24h = ctx.from?.id ? getBalance24hAgo(ctx.from.id) : null;

    let changeSection = '';
    if (balance24h) {
      const prev = balance24h.nearBalance ?? 0;
      const dNear = totalNear - prev;
      const pct   = prev > 0 ? (dNear / prev * 100) : 0;
      const sign  = dNear >= 0 ? '+' : '';
      changeSection = `\n📊 *Изменение за 24ч:*\n${dNear >= 0 ? '📈' : '📉'} ${sign}${fmt(dNear)} NEAR (${sign}${pct.toFixed(2)}%)${fmtUsd(dNear, nearPrice)}\n`;
    } else {
      changeSection = '\n📊 *Изменение за 24ч:*\n_Данных пока нет — зайди завтра_\n';
    }

    const last24hTxs = txns.filter(tx => {
      const ts = parseInt(tx.block_timestamp) / 1000000;
      return ts > Date.now() - 24 * 60 * 60 * 1000;
    });

    const message =
      `${HEADER}\n📊 *Аналитика*\n👤 \`${address}\`\n━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Баланс:* ${fmt(totalNear)} NEAR${fmtUsd(totalNear, nearPrice)}\n` +
      `🔥 *HOT:* ${fmt(hotBalance)}\n` +
      changeSection +
      `📈 *Активность (24ч):* ${last24hTxs.length} транзакций\n━━━━━━━━━━━━━━━━━━`;

    await ctx.replyWithMarkdown(message, mainMenu());
  } catch (e) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    await ctx.reply('❌ Ошибка аналитики.', mainMenu());
  }
}

// ─── 📜 Транзакции ────────────────────────────────────────────────────────
async function handleTransactions(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;
  const loading = await ctx.reply('⏳ Загружаю транзакции...');
  try {
    const nearPrice = await getNearPrice().catch(() => null);
    const analyzed  = await getTransactionsForDisplay(address, nearPrice, 10);
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
    if (!analyzed?.length) return ctx.reply('📭 История пуста.', mainMenu());

    let message = `${HEADER}\n📜 *Последние транзакции*\n👤 \`${address}\`\n━━━━━━━━━━━━━━━━━━\n\n`;
    analyzed.slice(0, 5).forEach((tx, idx) => {
      const timeAgo = dayjs(tx.timestamp).fromNow();
      message += `${tx.icon} *${tx.description}*\n`;
      if (tx.amount > 0.01) message += `💰 *${fmt(tx.amount)} NEAR*${fmtUsd(tx.amount, nearPrice)}\n`;
      message += `🕒 ${timeAgo}\n`;
      if (idx < 4) message += '\n';
    });
    message += '\n━━━━━━━━━━━━━━━━━━';
    await ctx.replyWithMarkdown(message, mainMenu());
  } catch (e) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    await ctx.reply('❌ Ошибка транзакций.', mainMenu());
  }
}

// ─── 📈 Pulse ─────────────────────────────────────────────────────────────
async function handlePulse(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address = user.nearAddress;
  const loading = await ctx.reply('⏳ Анализирую активность...');
  try {
    const [transactions, nearData, stakingBalance, hotBalance] = await Promise.all([
      getTransactionHistory(address),
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address),
    ]);
    const report = await generatePulseReport(transactions, address);
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);

    const balance24h = ctx.from?.id ? getBalance24hAgo(ctx.from.id) : null;
    const currentNear = nearData.near + stakingBalance;
    const compBlock = formatBalanceComparison(balance24h, currentNear, hotBalance);

    const message =
      `${HEADER}\n📈 *Pulse* | \`${address}\`\n━━━━━━━━━━━━━━━━━━\n\n` +
      report +
      (compBlock ? '\n\n---\n' + compBlock : '');

    await ctx.replyWithMarkdown(message, mainMenu());
  } catch (e) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    await ctx.reply('❌ ' + (e.message || 'Ошибка отчёта.'), mainMenu());
  }
}

// ─── 📉 График ────────────────────────────────────────────────────────────
async function handleChart(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const userId = ctx.from?.id;
  const history = userId ? getBalanceHistory(userId) : [];

  if (!history || history.length < 2) {
    return ctx.replyWithMarkdown(
      `${HEADER}\n📉 *График баланса*\n\n` +
      '_Пока недостаточно данных. График появится после нескольких дней использования._\n\n' +
      'Каждый раз когда ты смотришь баланс — создаётся точка на графике.',
      mainMenu()
    );
  }

  const chart = buildAsciiChart(history, 'NEAR');
  if (!chart) {
    return ctx.replyWithMarkdown(`${HEADER}\n📉 Баланс не менялся за этот период.`, mainMenu());
  }

  // Статистика
  const values  = history.map(p => p.nearBalance || 0);
  const current = values[values.length - 1];
  const oldest  = values[0];
  const maxVal  = Math.max(...values);
  const minVal  = Math.min(...values);
  const days    = Math.round((history[history.length-1].timestamp - history[0].timestamp) / (24*60*60*1000));

  const message =
    `${HEADER}\n📉 *График баланса*\n👤 \`${user.nearAddress}\`\n━━━━━━━━━━━━━━━━━━\n\n` +
    chart + '\n\n' +
    `📅 *Период:* ${days} дн.\n` +
    `📍 *Сейчас:* ${fmt(current)} NEAR\n` +
    `📌 *Начало:* ${fmt(oldest)} NEAR\n` +
    `🔺 *Макс:* ${fmt(maxVal)} NEAR\n` +
    `🔻 *Мин:* ${fmt(minVal)} NEAR\n` +
    '━━━━━━━━━━━━━━━━━━';

  await ctx.replyWithMarkdown(message, mainMenu());
}

// ─── 🔍 Поиск транзакции по хэшу ─────────────────────────────────────────
async function handleTxLookup(ctx, hash) {
  const loading = await ctx.reply('⏳ Ищу транзакцию...');
  try {
    const r = await fetch(
      `https://api.nearblocks.io/v1/txns/${hash.trim()}`,
      { headers: { 'Accept': 'application/json' } }
    );
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);

    if (!r.ok) {
      return ctx.replyWithMarkdown(
        `${HEADER}\n🔍 *Транзакция не найдена*\n\`${hash.slice(0, 20)}...\`\n\nПроверь хэш и попробуй снова.`,
        mainMenu()
      );
    }

    const data = await r.json();
    const tx   = data.txns?.[0] || data.txn || data;

    const status    = tx.outcomes?.status === true || tx.receipt_outcome?.outcome?.status?.SuccessValue !== undefined;
    const statusIcon = status ? '✅' : '❌';
    const from      = tx.signer_account_id || tx.from || '?';
    const to        = tx.receiver_account_id || tx.to || '?';
    const amount    = tx.actions_agg?.deposit
      ? (parseFloat(tx.actions_agg.deposit) / 1e24).toFixed(4)
      : null;
    const gas       = tx.outcomes_agg?.transaction_fee
      ? (parseFloat(tx.outcomes_agg.transaction_fee) / 1e24).toFixed(6)
      : null;
    const time      = tx.block_timestamp
      ? dayjs(parseInt(tx.block_timestamp) / 1000000).fromNow()
      : '?';
    const method    = tx.actions?.[0]?.action === 'FUNCTION_CALL'
      ? tx.actions[0].method
      : tx.actions?.[0]?.action || 'Transfer';

    const message =
      `${HEADER}\n🔍 *Транзакция*\n\`${hash.slice(0, 24)}...\`\n━━━━━━━━━━━━━━━━━━\n` +
      `${statusIcon} *Статус:* ${status ? 'Успешно' : 'Ошибка'}\n` +
      `📤 *От:* \`${from}\`\n` +
      `📥 *Кому:* \`${to}\`\n` +
      `⚡ *Метод:* \`${method}\`\n` +
      (amount ? `💰 *Сумма:* ${amount} NEAR\n` : '') +
      (gas    ? `⛽ *Gas:* ${gas} NEAR\n`       : '') +
      `🕒 *Время:* ${time}\n` +
      `🔗 [NearBlocks](https://nearblocks.io/txns/${hash})\n` +
      '━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message, { ...mainMenu(), disable_web_page_preview: true });
  } catch (e) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    console.error('[txLookup]', e.message);
    await ctx.reply('❌ Ошибка при поиске транзакции.', mainMenu());
  }
}

// ─── 🌐 Mini App ──────────────────────────────────────────────────────────
async function handleApp(ctx, user) {
  if (!await requireAddress(ctx, user)) return;
  const address   = user.nearAddress;
  const webappUrl = process.env.WEBAPP_URL || 'https://nearpulseapp.netlify.app';
  const url       = `${webappUrl}?address=${encodeURIComponent(address)}`;

  await ctx.replyWithMarkdown(
    `${HEADER}\n📊 *NearPulse Analytics*\n━━━━━━━━━━━━━━━━━━\n\nОткрой приложение для детальной аналитики \`${address}\``,
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.webApp('📊 Открыть NearPulse', url)]]) }
  );
}

// ─── ⚙️ Настройки ─────────────────────────────────────────────────────────
async function handleSettings(ctx, user) {
  const userId           = ctx.from?.id;
  const hotNotifyEnabled = user?.hotNotifyEnabled ?? false;
  const hasAddress       = !!user?.nearAddress;
  const alerts           = userId ? getPriceAlerts(userId) : [];
  const notifyLabel      = hotNotifyEnabled ? '🔔 Вкл.' : '🔕 Выкл.';

  let alertsSection = '\n💸 *Price Alerts:* нет активных\n';
  if (alerts.length > 0) {
    alertsSection = '\n💸 *Price Alerts:*\n';
    alerts.forEach(a => {
      alertsSection += `• ${a.symbol} ${a.direction === 'above' ? '↑' : '↓'} $${a.targetPrice} [/del${a.id}]\n`;
    });
  }

  const message =
    `${HEADER}\n⚙️ *Настройки*\n━━━━━━━━━━━━━━━━━━\n\n` +
    (hasAddress ? `👤 *Кошелёк:* \`${user.nearAddress}\`\n\n` : '') +
    `🔔 *HOT уведомление* — ${notifyLabel}\n` +
    alertsSection +
    '\n_Добавить алерт: `/alert NEAR 5.50 above`_';

  const keyboard = hasAddress
    ? Markup.inlineKeyboard([
        [Markup.button.callback(hotNotifyEnabled ? '🔕 Откл. HOT' : '🔔 Вкл. HOT', 'hot_notify_toggle')],
        [Markup.button.callback('🔄 Сменить кошелёк', 'change_address')],
      ])
    : Markup.inlineKeyboard([]);

  await ctx.replyWithMarkdown(message, keyboard);
}

// ─── Price Alerts: команда ────────────────────────────────────────────────
async function handleAlertCommand(ctx, text, user) {
  if (!await requireAddress(ctx, user)) return;
  const userId = ctx.from?.id;

  // Формат: /alert NEAR 5.50 above|below
  // или просто: алерт NEAR 5.50
  const parts = text.replace(/^\/alert\s*/i, '').replace(/^алерт\s*/i, '').split(/\s+/);

  if (parts.length < 2) {
    return ctx.replyWithMarkdown(
      `${HEADER}\n💸 *Price Alert*\n\n` +
      'Формат: `/alert NEAR 5.50 above`\n\n' +
      '• `above` — уведомить когда цена *выше* $5.50\n' +
      '• `below` — уведомить когда цена *ниже* $5.50\n\n' +
      '_По умолчанию: above_',
      mainMenu()
    );
  }

  const symbol      = parts[0].toUpperCase();
  const targetPrice = parseFloat(parts[1]);
  const direction   = (parts[2] || 'above').toLowerCase() === 'below' ? 'below' : 'above';

  if (isNaN(targetPrice) || targetPrice <= 0) {
    return ctx.reply('❌ Неверная цена. Пример: /alert NEAR 5.50', mainMenu());
  }

  const result = addPriceAlert(userId, symbol, targetPrice, direction);
  if (result.error) return ctx.reply(`❌ ${result.error}`, mainMenu());

  const dirLabel = direction === 'above' ? 'поднимется выше' : 'опустится ниже';
  await ctx.replyWithMarkdown(
    `${HEADER}\n✅ *Алерт создан*\n\n` +
    `Уведомлю когда ${symbol} ${dirLabel} *$${targetPrice}*\n\n` +
    `_ID алерта: ${result.alert.id} — удалить: /del${result.alert.id}_`,
    mainMenu()
  );
}

// Удаление алерта: /del5
bot.hears(/^\/del(\d+)$/, async (ctx) => {
  const userId  = ctx.from?.id;
  const alertId = parseInt(ctx.match[1]);
  if (!userId) return;
  const ok = removePriceAlert(userId, alertId);
  await ctx.reply(ok ? `✅ Алерт #${alertId} удалён.` : `❌ Алерт #${alertId} не найден.`, mainMenu());
});

// ─── Inline кнопки ────────────────────────────────────────────────────────
bot.action('hot_notify_toggle', (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return ctx.answerCbQuery('Ошибка');
  const user = getUser(userId);
  if (!user?.nearAddress) return ctx.answerCbQuery('Сначала укажи адрес');
  const newState = !user.hotNotifyEnabled;
  setHotNotify(userId, newState);
  ctx.answerCbQuery(newState ? '🔔 Включены' : '🔕 Отключены');
  handleSettings(ctx, getUser(userId));
});

bot.action('change_address', async (ctx) => {
  ctx.answerCbQuery();
  await ctx.replyWithMarkdown('Отправь новый NEAR адрес:\n\n`***.near` или `***.tg`', Markup.removeKeyboard());
});

// ─── Совместимость со старыми командами ──────────────────────────────────
bot.command('balance',      (ctx) => handleBalance(ctx,      getUser(ctx.from?.id)));
bot.command('analytics',    (ctx) => handleAnalytics(ctx,    getUser(ctx.from?.id)));
bot.command('transactions', (ctx) => handleTransactions(ctx, getUser(ctx.from?.id)));
bot.command('pulse',        (ctx) => handlePulse(ctx,        getUser(ctx.from?.id)));
bot.command('chart',        (ctx) => handleChart(ctx,        getUser(ctx.from?.id)));
bot.command('app',          (ctx) => handleApp(ctx,          getUser(ctx.from?.id)));
bot.command('settings',     (ctx) => handleSettings(ctx,     getUser(ctx.from?.id)));
bot.command('alert',        (ctx) => handleAlertCommand(ctx, ctx.message.text, getUser(ctx.from?.id)));

// ─── Вспомогательные функции ──────────────────────────────────────────────
function formatBalanceComparison(balance24h, currentNear, currentHot) {
  if (!balance24h) return '';
  const prevNear = balance24h.nearBalance ?? balance24h.nearAmount ?? 0;
  const prevHot  = balance24h.hotBalance  ?? balance24h.hotAmount  ?? 0;
  const dNear    = currentNear - prevNear;
  const dHot     = currentHot  - prevHot;
  const signN    = dNear >= 0 ? '+' : '';
  const signH    = dHot  >= 0 ? '+' : '';
  return (
    '📊 *Динамика за 24ч*\n' +
    `NEAR: ${fmt(prevNear)} → ${fmt(currentNear)} (${signN}${fmt(dNear)})\n` +
    `HOT: ${fmt(prevHot)} → ${fmt(currentHot)} (${signH}${fmt(dHot)})`
  );
}

// ─── HOT Monitor ─────────────────────────────────────────────────────────
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
          await bot.telegram.sendMessage(telegramId,
            status.readyToClaim ? '🔥 Пора забирать HOT!' : `🔥 До клейма HOT ~${totalMinutes} мин!`
          );
          updateLastHotNotify(telegramId);
        }
      } catch (e) { console.error('[HOT Monitor]', nearAddress, e.message); }
    }
  } catch (e) { console.error('[HOT Monitor]', e.message); }
}

// ─── Price Alert Monitor ─────────────────────────────────────────────────
async function runPriceAlertMonitor() {
  try {
    const usersWithAlerts = getAllUsersWithAlerts();
    if (!usersWithAlerts.length) return;

    // Получаем текущие цены
    const priceCache = {};
    const getPrice = async (symbol) => {
      if (priceCache[symbol] !== undefined) return priceCache[symbol];
      try {
        const ids = { NEAR: 'near', HOT: 'hot-protocol', BTC: 'bitcoin', ETH: 'ethereum' };
        const id  = ids[symbol];
        if (!id) { priceCache[symbol] = null; return null; }
        const r   = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
        const d   = await r.json();
        priceCache[symbol] = d[id]?.usd || null;
      } catch { priceCache[symbol] = null; }
      return priceCache[symbol];
    };

    for (const { telegramId, alerts } of usersWithAlerts) {
      for (const alert of alerts) {
        const currentPrice = await getPrice(alert.symbol);
        if (!currentPrice) continue;

        const triggered =
          (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
          (alert.direction === 'below' && currentPrice <= alert.targetPrice);

        if (triggered) {
          const dirLabel = alert.direction === 'above' ? 'поднялся выше' : 'опустился ниже';
          await bot.telegram.sendMessage(telegramId,
            `🔔 *Price Alert*\n\n${alert.symbol} ${dirLabel} *$${alert.targetPrice}*\n\nТекущая цена: *$${currentPrice}*`,
            { parse_mode: 'Markdown' }
          );
          deactivatePriceAlert(telegramId, alert.id);
        }
      }
    }
  } catch (e) { console.error('[Price Monitor]', e.message); }
}

// ─── Запуск ───────────────────────────────────────────────────────────────
async function launchBot() {
  const maxRetries = 10;
  const baseDelay  = 8000;
  if (process.env.RAILWAY_ENVIRONMENT) {
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
      cron.schedule('*/5  * * * *', runPriceAlertMonitor); // Каждые 5 минут
      console.log('⏰ HOT Monitor: 15 мин | Price Monitor: 5 мин');
      setTimeout(runHotClaimMonitor, 10000);
      return;
    } catch (error) {
      if (error.message?.includes('409') && attempt < maxRetries) {
        const delay = baseDelay * attempt;
        console.warn(`⚠️ Conflict 409, retry ${attempt}/${maxRetries} in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('❌ Bot launch failed:', error.message);
        return;
      }
    }
  }
}

async function main() {
  try { getDb(); } catch (e) { console.error('DB error:', e.message); }
  await launchBot();
}

process.on('uncaughtException',  (e) => console.error('Uncaught:', e.message));
process.on('unhandledRejection', (e) => console.error('Unhandled:', e?.message || e));
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

main().catch(e => console.error('Main error:', e.message));
