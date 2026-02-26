/**
 * API Service для работы с NearPulse REST API
 * v2.1.0 — добавлен AI chat + исправлен endpoint для NFTs
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://nearpulse.onrender.com';

export async function fetchUserBalance(address) {
  const response = await fetch(`${API_BASE_URL}/api/balance/${address}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

export async function fetchTransactions(address, limit = 10) {
  const cacheBust = `_=${Date.now()}`;
  const response = await fetch(`${API_BASE_URL}/api/transactions/${address}?limit=${limit}&${cacheBust}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  const nearPrice = data.nearPrice || 0;
  if (data.transactions) {
    data.transactions = data.transactions.map(tx => ({
      ...tx,
      hash: tx.hash || tx.id || '',
      description: tx.description || tx.action || 'Транзакция',
      amount: tx.amount ?? tx.allNearSpent ?? tx.allNearReceived ?? 0,
      amountFormatted: tx.amountFormatted ?? (tx.amount || tx.allNearSpent || tx.allNearReceived || 0).toFixed(4),
      usdValue: tx.usdValue ?? (nearPrice && (tx.amount || tx.allNearSpent) > 0 ? (tx.amount || tx.allNearSpent) * nearPrice : null),
      tokenName: tx.tokenName || null,
      gas: tx.gas ?? null,
      protocol: tx.protocol || null,
      txCount: tx.txCount || 1,
    }));
  }
  return data;
}

export async function fetchHotClaimStatus(address) {
  const response = await fetch(`${API_BASE_URL}/api/hot-claim/${address}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

export async function checkApiHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

// Кэш аналитики
let analyticsCache = { key: null, data: null, ts: 0 };
const ANALYTICS_CACHE_TTL = 60000;

export async function fetchAnalytics(address, period = 'week') {
  const key = `${address}:${period}`;
  const now = Date.now();
  if (analyticsCache.key === key && analyticsCache.data && (now - analyticsCache.ts) < ANALYTICS_CACHE_TTL) {
    return analyticsCache.data;
  }
  const response = await fetch(`${API_BASE_URL}/api/stats/${address}?period=${period}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  analyticsCache = { key, data, ts: Date.now() };
  return data;
}

// BUGFIX: исправлен endpoint с /api/nfts/ (как вызывал webapp) — теперь совпадает
export async function fetchNFTs(address) {
  const response = await fetch(`${API_BASE_URL}/api/nfts/${address}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

/**
 * AI Chat — отправить сообщение аналитику
 * @param {string} message - Сообщение пользователя
 * @param {Array} history - История диалога [{role, content}]
 * @param {Object|null} walletContext - Данные кошелька для персонализации
 * @returns {Promise<{reply: string, model: string}>}
 */
export async function sendAiMessage(message, history = [], walletContext = null) {
  const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, walletContext }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export default {
  fetchUserBalance,
  fetchTransactions,
  fetchHotClaimStatus,
  checkApiHealth,
  fetchAnalytics,
  fetchNFTs,
  sendAiMessage,
};
