require('dotenv/config');
const express = require('express');
const cors = require('cors');
const {
  getBalance,
  getTokenBalance,
  getTokensWithPrices,
  getStakingBalance,
  getNearPrice,
} = require('./services/nearService');

const app = express();
const PORT = process.env.API_PORT || 3001;

// CORS - разрешаем запросы с фронтенда
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://near-pulse.vercel.app',
  process.env.WEBAPP_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Проверяем что origin в списке разрешённых
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(allowed => origin?.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// JSON parser
app.use(express.json());

// Логирование запросов с деталями
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  console.log(`[API] Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  console.log(`[API] Headers: Origin=${req.get('origin')}, Referer=${req.get('referer')}`);
  next();
});

/**
 * GET /api/balance/:address и /balance/:address
 * Возвращает полный баланс аккаунта: NEAR, staking, HOT, токены
 * Два роута для совместимости: локальный и Vercel
 */
app.get(['/api/balance/:address', '/balance/:address'], async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`[API] Запрос баланса для ${address}`);
    
    // Параллельно получаем все данные
    const [nearData, stakingBalance, hotBalance, nearPrice, categorizedTokens] = await Promise.all([
      getBalance(address),
      getStakingBalance(address),
      getTokenBalance(address, 'game.hot.tg'),
      getNearPrice().catch(() => null),
      getTokensWithPrices(address, 1), // минимум $1 для отображения
    ]);
    
    // Считаем общую стоимость
    const nearAmount = nearData.near + stakingBalance;
    const totalValue = nearAmount;
    
    // Формируем ответ
    const response = {
      address,
      timestamp: Date.now(),
      near: {
        available: nearData.near,
        staked: stakingBalance,
        total: nearAmount,
        price: nearPrice,
        usdValue: nearPrice ? nearAmount * nearPrice : null,
      },
      hot: {
        amount: hotBalance,
      },
      tokens: {
        major: categorizedTokens.major,
        filtered: categorizedTokens.filtered,
        hidden: categorizedTokens.hidden,
      },
      totalValue: {
        near: totalValue,
        usd: nearPrice ? totalValue * nearPrice : null,
      },
    };
    
    res.json(response);
  } catch (error) {
    console.error('[API] Ошибка в /api/balance:', error.message);
    res.status(500).json({
      error: 'Failed to fetch balance',
      message: error.message,
    });
  }
});

/**
 * GET /api/health и /health
 * Проверка работоспособности API
 * Два роута для совместимости: локальный и Vercel
 */
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'NearPulse API',
    environment: process.env.VERCEL ? 'vercel' : 'local',
  });
});

/**
 * GET / и /api
 * Корневой путь - информация об API
 */
app.get(['/', '/api'], (req, res) => {
  res.json({
    name: 'NearPulse API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health - Health check',
      'GET /api/balance/:address - Get account balance',
    ],
  });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Запуск сервера ТОЛЬКО если файл запущен напрямую (не импортирован)
// Это позволяет использовать app как модуль в Vercel serverless функциях
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 NearPulse API запущен на http://localhost:${PORT}`);
    console.log(`📱 CORS разрешён для: ${process.env.WEBAPP_URL || 'http://localhost:5173'}`);
  });
}

// Экспорт для использования в Vercel и других окружениях
module.exports = app;
