/**
 * Vercel Serverless Function для NearPulse API
 * Переиспользует Express app из src/api.js
 */

// Импортируем готовый Express app из src/api.js
// Благодаря проверке require.main === module в src/api.js,
// сервер не будет запускаться, а только экспортируется
const app = require('../src/api');

// Экспорт для Vercel Serverless Functions
module.exports = app;
