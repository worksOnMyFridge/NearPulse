// Простое хранилище в памяти (вместо БД)
const users = new Map();

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

function saveBalanceSnapshot() {
  // Пока не сохраняем
}

function getBalance24hAgo() {
  return null; // Нет истории
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
  NOTIFY_COOLDOWN_SEC,
};