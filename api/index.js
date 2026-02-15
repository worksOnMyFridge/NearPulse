/**
 * Vercel Serverless Function для NearPulse API
 * Переиспользует Express app из src/api.js
 */

const app = require('../src/api');

// Экспорт для Vercel Serverless Functions
// Vercel автоматически обрабатывает Express app как serverless function
module.exports = app;
