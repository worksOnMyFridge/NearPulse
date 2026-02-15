// Простое хранилище в памяти (вместо БД)
const users = new Map();
// История балансов: Map<telegramId, Array<{timestamp, nearBalance, hotBalance}>>
const balanceHistory = new Map();

function getUser(telegramId) {
  return users.get(telegramId) || null;
}

function updateUserAddress(telegramId, nearAddress) {
  const user = users.get(telegramId) || {};
  user.nearAddress = nearAddress;
  user.hotNotifyEnabled = user.hotNotifyEnabled || false;
  users.set(telegramId, user);
}

function setHotNotify(telegramId, enabled) {
  const user = users.get(telegramId) || {};
  user.hotNotifyEnabled = enabled;
  users.set(telegramId, user);
}

function getUsersForMonitoring() {
  const result = [];
  for (const [telegramId, user] of users.entries()) {
    if (user.hotNotifyEnabled && user.nearAddress) {
      result.push({
        telegramId,
        nearAddress: user.nearAddress,
        lastHotNotifyAt: user.lastHotNotifyAt || 0,
      });
    }
  }
  return result;
}

function updateLastHotNotify(telegramId) {
  const user = users.get(telegramId);
  if (user) {
    user.lastHotNotifyAt = Math.floor(Date.now() / 1000);
    users.set(telegramId, user);
  }
}

const NOTIFY_COOLDOWN_SEC = 3600; // 1 час

function getDb() {
  return {}; // Заглушка
}

/**
 * Сохраняет снимок баланса пользователя
 * @param {number} telegramId - ID пользователя в Telegram
 * @param {string} address - NEAR адрес
 * @param {number} nearBalance - Баланс NEAR (включая стейкинг)
 * @param {number} hotBalance - Баланс HOT токенов
 */
function saveBalanceSnapshot(telegramId, address, nearBalance, hotBalance) {
  if (!telegramId || !address) return;

  const history = balanceHistory.get(telegramId) || [];
  const now = Date.now();

  // Добавляем новый снимок
  history.push({
    timestamp: now,
    address,
    nearBalance: nearBalance || 0,
    hotBalance: hotBalance || 0,
  });

  // Оставляем только последние 30 дней (для экономии памяти)
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const filtered = history.filter(h => h.timestamp > thirtyDaysAgo);

  balanceHistory.set(telegramId, filtered);

  // Логирование только в dev режиме
  if (process.env.NODE_ENV !== 'production') {
    console.log(`💾 [DEV] Сохранён снимок баланса для ${address}: ${nearBalance.toFixed(2)} NEAR, ${hotBalance.toFixed(2)} HOT`);
  }
}

/**
 * Получает баланс 24 часа назад
 * @param {number} telegramId - ID пользователя в Telegram
 * @returns {Object|null} Баланс 24ч назад или null
 */
function getBalance24hAgo(telegramId) {
  const history = balanceHistory.get(telegramId);
  if (!history || history.length === 0) {
    return null;
  }

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Ищем снимок ближайший к 24ч назад
  let closest = null;
  let minDiff = Infinity;

  for (const snapshot of history) {
    const diff = Math.abs(snapshot.timestamp - oneDayAgo);
    if (diff < minDiff) {
      minDiff = diff;
      closest = snapshot;
    }
  }

  return closest;
}

/**
 * Получает всю историю балансов пользователя
 * @param {number} telegramId - ID пользователя
 * @returns {Array} Массив снимков
 */
function getBalanceHistory(telegramId) {
  return balanceHistory.get(telegramId) || [];
}

module.exports = {
  getDb,
  getUser,
  updateUserAddress,
  setHotNotify,
  getUsersForMonitoring,
  updateLastHotNotify,
  saveBalanceSnapshot,
  getBalance24hAgo,
  getBalanceHistory,
  NOTIFY_COOLDOWN_SEC,
};