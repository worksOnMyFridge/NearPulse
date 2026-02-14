const axios = require('axios');
const { NEARBLOCKS_API_URL, API_TIMEOUT } = require('../config/constants');

const YOCTO_NEAR = 1e24;

/**
 * Получает баланс NEAR-кошелька через Nearblocks API.
 * @param {string} address - NEAR-адрес (named или implicit)
 * @returns {Promise<{ address: string, near: number, raw: string }>}
 */
async function getBalance(address) {
  try {
    const response = await axios.get(
      `${NEARBLOCKS_API_URL}/account/${address}`,
      { timeout: API_TIMEOUT }
    );

    // amount приходит в yoctoNEAR (строка)
    const amount = response.data?.account?.amount ?? '0';
    const near = Number(amount) / YOCTO_NEAR;

    return {
      address,
      near,
      raw: amount,
    };
  } catch (error) {
    console.error('getBalance error:', error.message);
    throw new Error('Не удалось получить баланс');
  }
}

module.exports = { getBalance };
