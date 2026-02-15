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
 * Получить количество NFT (быстро, без метаданных)
 * @param {string} address - NEAR адрес
 * @returns {Promise<Object>} { total, wallet, hotStaked }
 */
export async function fetchNFTCount(address) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nfts/count/${address}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching NFT count:', error);
    // Fail-Safe: возвращаем 0 вместо ошибки
    return { total: 0, wallet: 0, hotStaked: 0, error: 'NFT_COUNT_FAILED' };
  }
}

/**
 * Получить NFT с пагинацией
 * @param {string} address - NEAR адрес
 * @param {number} page - Номер страницы (начиная с 1)
 * @param {number} limit - Количество NFT на странице (по умолчанию 50)
 * @returns {Promise<Object>} NFT с пагинацией
 */
export async function fetchNFTsPaginated(address, page = 1, limit = 50) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nfts/${address}?page=${page}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Проверяем на ошибку в ответе
    if (data.error) {
      console.warn(`NFT load error: ${data.error}`, data.message);
      return {
        ...data,
        nfts: data.wallet || [],
        hasMore: false,
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    // Fail-Safe: возвращаем пустой результат
    return {
      wallet: [],
      hotStaked: [],
      total: 0,
      page,
      limit,
      hasMore: false,
      error: 'NFT_FETCH_FAILED',
    };
  }
}

/**
 * LEGACY: Получить NFT пользователя (кошелёк + застейканные в HOT)
 * @param {string} address - NEAR адрес
 * @returns {Promise<Object>} NFT пользователя
 */
export async function fetchNFTs(address) {
  return fetchNFTsPaginated(address, 1, 50);
}

/**
 * Пометить NFT как спам
 * @param {string} address - NEAR адрес
 * @param {Array<string>} nftIds - Массив ID NFT для пометки
 * @returns {Promise<Object>} Результат операции
 */
export async function markNFTsAsSpam(address, nftIds) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nfts/spam`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, nftIds }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error marking NFTs as spam:', error);
    throw error;
  }
}

/**
 * Восстановить NFT из спама
 * @param {string} address - NEAR адрес
 * @param {Array<string>} nftIds - Массив ID NFT для восстановления
 * @returns {Promise<Object>} Результат операции
 */
export async function restoreNFTsFromSpam(address, nftIds) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nfts/spam`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, nftIds }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error restoring NFTs from spam:', error);
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
  fetchNFTCount,
  fetchNFTsPaginated,
  markNFTsAsSpam,
  restoreNFTsFromSpam,
};
