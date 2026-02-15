/**
 * Vercel Serverless Function для NearPulse API
 * Переиспользует Express app из src/api.js
 */

// Импортируем готовый Express app из src/api.js
// Благодаря проверке require.main === module в src/api.js,
// сервер не будет запускаться, а только экспортируется
const app = require('../src/api');

// Экспорт для Vercel Serverless Functions
// Vercel автоматически обрабатывает Express app
module.exports = app;

// Альтернативный экспорт как default для совместимости
module.exports.default = app;
