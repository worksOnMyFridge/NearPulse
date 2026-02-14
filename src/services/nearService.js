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

/**
 * Получает баланс fungible токена HOT (game.hot.tg) для адреса.
 * @param {string} address - NEAR-адрес
 * @param {string} [tokenId='game.hot.tg'] - контракт токена
 * @returns {Promise<number>} - баланс в человекочитаемом формате
 */
async function getTokenBalance(address, tokenId = 'game.hot.tg') {
  try {
    const url = `${NEARBLOCKS_API_URL}/account/${address}/inventory`;
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    const token = response.data.inventory.fts.find((t) => t.contract === tokenId);
    return token ? parseFloat(token.amount) / 1e6 : 0;
  } catch (error) {
    console.error('getTokenBalance error:', error.message);
    throw new Error('Ошибка получения HOT баланса');
  }
}

module.exports = { getBalance, getTokenBalance };
