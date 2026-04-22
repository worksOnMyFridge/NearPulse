// NearPulse — хранилище в памяти (in-memory)
const users          = new Map();
const balanceHistory = new Map();
const priceAlerts    = new Map();
let alertIdCounter   = 1;

// ─── Users ────────────────────────────────────────────────────────────────
function getUser(telegramId) { return users.get(telegramId) || null; }

function updateUserAddress(telegramId, nearAddress) {
  const user = users.get(telegramId) || {};
  user.nearAddress      = nearAddress;
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
      result.push({ telegramId, nearAddress: user.nearAddress, lastHotNotifyAt: user.lastHotNotifyAt || 0 });
    }
  }
  return result;
}

function updateLastHotNotify(telegramId) {
  const user = users.get(telegramId);
  if (user) { user.lastHotNotifyAt = Math.floor(Date.now() / 1000); users.set(telegramId, user); }
}

const NOTIFY_COOLDOWN_SEC = 3600;
function getDb() { return {}; }

// ─── Balance History ──────────────────────────────────────────────────────
function saveBalanceSnapshot(telegramId, address, nearBalance, hotBalance) {
  if (!telegramId || !address) return;
  const history = balanceHistory.get(telegramId) || [];
  const now = Date.now();
  history.push({ timestamp: now, address, nearBalance: nearBalance || 0, hotBalance: hotBalance || 0 });
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  balanceHistory.set(telegramId, history.filter(h => h.timestamp > thirtyDaysAgo));
  if (process.env.NODE_ENV !== 'production') {
    console.log(`💾 Snapshot: ${address} — ${(nearBalance||0).toFixed(2)} NEAR`);
  }
}

function getBalance24hAgo(telegramId) {
  const history = balanceHistory.get(telegramId);
  if (!history || !history.length) return null;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let closest = null, minDiff = Infinity;
  for (const s of history) {
    const diff = Math.abs(s.timestamp - oneDayAgo);
    if (diff < minDiff) { minDiff = diff; closest = s; }
  }
  return closest;
}

function getBalanceHistory(telegramId) { return balanceHistory.get(telegramId) || []; }

// ─── Price Alerts ─────────────────────────────────────────────────────────
function addPriceAlert(telegramId, symbol, targetPrice, direction = 'above') {
  const alerts = priceAlerts.get(telegramId) || [];
  if (alerts.filter(a => a.active).length >= 5) {
    return { error: 'Максимум 5 активных алертов. Удали старые через ⚙️ Настройки.' };
  }
  const alert = { id: alertIdCounter++, symbol: symbol.toUpperCase(), targetPrice: parseFloat(targetPrice), direction, active: true, createdAt: Date.now() };
  alerts.push(alert);
  priceAlerts.set(telegramId, alerts);
  return { ok: true, alert };
}

function removePriceAlert(telegramId, alertId) {
  const alerts = priceAlerts.get(telegramId) || [];
  const idx = alerts.findIndex(a => a.id === alertId);
  if (idx === -1) return false;
  alerts.splice(idx, 1);
  priceAlerts.set(telegramId, alerts);
  return true;
}

function getPriceAlerts(telegramId) { return (priceAlerts.get(telegramId) || []).filter(a => a.active); }

function getAllUsersWithAlerts() {
  const result = [];
  for (const [telegramId, alerts] of priceAlerts.entries()) {
    const active = alerts.filter(a => a.active);
    if (active.length) result.push({ telegramId, alerts: active });
  }
  return result;
}

function deactivatePriceAlert(telegramId, alertId) {
  const alerts = priceAlerts.get(telegramId) || [];
  const alert = alerts.find(a => a.id === alertId);
  if (alert) alert.active = false;
}

module.exports = {
  getDb, getUser, updateUserAddress, setHotNotify, getUsersForMonitoring,
  updateLastHotNotify, saveBalanceSnapshot, getBalance24hAgo, getBalanceHistory,
  addPriceAlert, removePriceAlert, getPriceAlerts, getAllUsersWithAlerts, deactivatePriceAlert,
  NOTIFY_COOLDOWN_SEC,
};
