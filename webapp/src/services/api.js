/**
 * API Service для работы с NearPulse REST API
 */

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

export default {
  fetchUserBalance,
  checkApiHealth,
};
