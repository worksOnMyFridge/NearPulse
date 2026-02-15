/**
 * API Service для работы с NearPulse REST API
 */

// Используем VITE_API_URL из переменных окружения
// Fallback на localhost для локальной разработки
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Получить баланс аккаунта
 * @param {string} address - NEAR адрес
 * @returns {Promise<Object>} Баланс и токены
 */
export async function fetchUserBalance(address) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/balance/${address}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching user balance:', error);
    throw error;
  }
}

/**
 * Получить историю транзакций
 * @param {string} address - NEAR адрес
 * @param {number} limit - Количество транзакций (по умолчанию 10)
 * @returns {Promise<Object>} История транзакций
 */
export async function fetchTransactions(address, limit = 10) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/transactions/${address}?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

/**
 * Получить статус HOT claim
 * @param {string} address - NEAR адрес
 * @returns {Promise<Object>} Статус клейма
 */
export async function fetchHotClaimStatus(address) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/hot-claim/${address}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching HOT claim status:', error);
    throw error;
  }
}

/**
 * Проверить работоспособность API
 * @returns {Promise<Object>} Статус API
 */
export async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking API health:', error);
    throw error;
  }
}

/**
 * Получить аналитику транзакций за период
 * @param {string} address - NEAR адрес
 * @param {string} period - Период: 'week', 'month', 'all' (по умолчанию 'week')
 * @returns {Promise<Object>} Аналитика транзакций
 */
export async function fetchAnalytics(address, period = 'week') {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analytics/${address}?period=${period}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}

/**
 * Получить NFT пользователя (кошелёк + застейканные в HOT)
 * @param {string} address - NEAR адрес
 * @returns {Promise<Object>} NFT пользователя
 */
export async function fetchNFTs(address) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nfts/${address}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    throw error;
  }
}

export default {
  fetchUserBalance,
  fetchTransactions,
  fetchHotClaimStatus,
  checkApiHealth,
  fetchAnalytics,
  fetchNFTs,
};
