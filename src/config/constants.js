/**
 * Базовые константы для NEAR Analytics Bot
 */

const NEARBLOCKS_API_URL = 'https://api.nearblocks.io/v1';
const PIKESPEAK_API_URL = 'https://api.pikespeak.ai';
const INTEAR_API_URL = 'https://prices.intear.tech'; // Intear Token Indexer (RHEA Finance + все токены)
const API_TIMEOUT = 30000; // 30 секунд (увеличено для стабильности)
const MAX_TRANSACTIONS = 50;

module.exports = {
  NEARBLOCKS_API_URL,
  PIKESPEAK_API_URL,
  INTEAR_API_URL,
  API_TIMEOUT,
  MAX_TRANSACTIONS,
};
