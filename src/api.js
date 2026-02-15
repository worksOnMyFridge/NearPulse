require('dotenv/config');
const express = require('express');
const cors = require('cors');
const {
  getBalance,
  getTokenBalance,
  getTokensWithPrices,
  getStakingBalance,
  getNearPrice,
  getTransactionHistory,
  getHotClaimStatus,
  getAnalytics,
  getNFTBalance,
  getHotStakedNFTs,
} = require('./services/nearService');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Увеличиваем таймауты для Railway
app.use((req, res, next) => {
  req.setTimeout(60000); // 60 секунд
  res.setTimeout(60000);
  next();
});

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
    
    // Разрешаем все Vercel preview deployments (*.vercel.app)
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // Проверяем что origin в списке разрешённых
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(allowed => origin?.startsWith(allowed))) {
      callback(null, true);
    } else {
      // ВАЖНО: Разрешаем все запросы в production для стабильности
      console.warn('[CORS] Unknown origin:', origin);
      callback(null, true); // Изменено с callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}));

// JSON parser
app.use(express.json());

/**
 * GET /api/balance/:address и /balance/:address
 * Возвращает полный баланс аккаунта: NEAR, staking, HOT, токены
 * Два роута для совместимости: локальный и Vercel
 */
app.get(['/api/balance/:address', '/balance/:address'], async (req, res) => {
  try {
    const { address } = req.params;
    
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
 * GET /api/transactions/:address и /transactions/:address
 * Возвращает историю транзакций
 */
app.get(['/api/transactions/:address', '/transactions/:address'], async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 10; // По умолчанию 10 транзакций
    
    const [txns, nearPrice] = await Promise.all([
      getTransactionHistory(address),
      getNearPrice().catch(() => null),
    ]);
    
    // Группируем по transaction_hash и берём только нужное количество
    const groupedTxns = {};
    txns.forEach(tx => {
      const hash = tx.transaction_hash;
      if (!groupedTxns[hash]) {
        groupedTxns[hash] = [];
      }
      groupedTxns[hash].push(tx);
    });

    const uniqueTxns = Object.entries(groupedTxns)
      .map(([hash, group]) => ({
        hash,
        timestamp: group[0].block_timestamp,
        transactions: group
      }))
      .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
      .slice(0, limit);
    
    // Анализируем каждую транзакцию
    const analyzed = uniqueTxns.map(txGroup => {
      const group = txGroup.transactions;
      const relevantTxs = group.filter(tx => 
        tx.receiver_account_id !== 'system' && 
        tx.predecessor_account_id !== 'system'
      );

      if (relevantTxs.length === 0) return null;

      const firstTx = relevantTxs[0];
      const contracts = relevantTxs.map(tx => tx.receiver_account_id);
      
      let totalNear = 0;
      relevantTxs.forEach(tx => {
        const deposit = tx.actions_agg?.deposit ? parseFloat(tx.actions_agg.deposit) / 1e24 : 0;
        if (tx.predecessor_account_id === address) {
          totalNear += deposit;
        } else if (tx.receiver_account_id === address) {
          totalNear -= deposit;
        }
      });

      const hasHot = contracts.some(c => c.includes('hot.tg') || c === 'game.hot.tg');
      const hasMoon = contracts.some(c => c.includes('harvest-moon'));
      const hasRef = contracts.some(c => c.includes('ref-finance'));
      const hasRhea = contracts.some(c => c.includes('rhea'));
      const hasTokenTransfer = contracts.some(c => 
        c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking')
      );

      let type = 'contract';
      let icon = '📝';
      let description = 'Contract call';
      let tokenName = null;

      if (hasHot) {
        type = 'hot_claim';
        icon = '🔥';
        description = 'Claim HOT';
      } else if (hasMoon) {
        type = 'claim';
        icon = '🎁';
        description = 'Claim MOON';
      } else if ((hasRef || hasRhea) && relevantTxs.length > 1) {
        type = 'swap';
        icon = '🔄';
        description = hasRef ? 'Swap (Ref Finance)' : 'Swap (RHEA)';
      } else if (Math.abs(totalNear) > 0.01 && !hasTokenTransfer) {
        const isOutgoing = totalNear > 0;
        type = isOutgoing ? 'transfer_out' : 'transfer_in';
        icon = isOutgoing ? '📤' : '📥';
        const otherParty = isOutgoing ? firstTx.receiver_account_id : firstTx.predecessor_account_id;
        
        // Укорачиваем длинные адреса
        const shortParty = otherParty.length > 20 
          ? otherParty.substring(0, 8) + '...' + otherParty.substring(otherParty.length - 6)
          : otherParty;
        
        description = isOutgoing ? `Отправлено → ${shortParty}` : `Получено ← ${shortParty}`;
      } else if (hasTokenTransfer) {
        const tokenContract = contracts.find(c => 
          c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking')
        );
        
        if (tokenContract) {
          const parts = tokenContract.split('.');
          if (parts[0] === 'token' && parts.length >= 3) {
            tokenName = parts[1].toUpperCase();
          } else if (tokenContract.includes('meme-cooking')) {
            tokenName = parts[0].split('-')[0].toUpperCase();
          } else if (tokenContract.includes('.tkn.')) {
            tokenName = parts[0].toUpperCase();
          } else {
            tokenName = parts[0].toUpperCase();
          }
        }

        const isOutgoing = firstTx.predecessor_account_id === address;
        type = isOutgoing ? 'token_out' : 'token_in';
        icon = '🪙';  // Единая иконка для токенов
        description = isOutgoing ? `Отправлен токен ${tokenName || 'Token'}` : `Получен токен ${tokenName || 'Token'}`;
      }

      // Конвертируем timestamp из наносекунд в миллисекунды
      const timestampRaw = parseInt(txGroup.timestamp);
      const timestampMs = timestampRaw > 1e15 ? Math.floor(timestampRaw / 1e6) : timestampRaw;
      
      return {
        hash: txGroup.hash,
        type,
        icon,
        description,
        amount: Math.abs(totalNear),
        amountFormatted: totalNear.toFixed(2),
        usdValue: nearPrice && Math.abs(totalNear) > 0.01 ? Math.abs(totalNear) * nearPrice : null,
        timestamp: timestampMs,
        tokenName,
      };
    }).filter(Boolean);
    
    res.json({
      address,
      transactions: analyzed,
      nearPrice,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API] Ошибка в /api/transactions:', error.message);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error.message,
    });
  }
});

/**
 * GET /api/hot-claim/:address и /hot-claim/:address
 * Возвращает статус клейма HOT
 */
app.get(['/api/hot-claim/:address', '/hot-claim/:address'], async (req, res) => {
  try {
    const { address } = req.params;
    
    const claimStatus = await getHotClaimStatus(address);
    
    res.json({
      address,
      ...claimStatus,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API] Ошибка в /api/hot-claim:', error.message);
    res.status(500).json({
      error: 'Failed to fetch HOT claim status',
      message: error.message,
    });
  }
});

/**
 * GET /api/analytics/:address и /analytics/:address
 * Возвращает аналитику транзакций за период
 * Query params: period=week|month|all (по умолчанию week)
 */
app.get(['/api/analytics/:address', '/analytics/:address'], async (req, res) => {
  try {
    const { address } = req.params;
    const period = req.query.period || 'week';
    
    // Валидация периода
    if (!['week', 'month', 'all'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid period',
        message: 'Period must be one of: week, month, all',
      });
    }
    
    console.log(`[API] Получаем аналитику для ${address}, период: ${period}`);
    
    const analytics = await getAnalytics(address, period);
    
    res.json({
      address,
      period,
      ...analytics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API] Ошибка в /api/analytics:', error.message);
    res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error.message,
    });
  }
});

/**
 * GET /api/nfts/:address и /nfts/:address
 * Возвращает список NFT пользователя (кошелёк + застейканные в HOT)
 * FAIL-SAFE: Всегда возвращает 200 OK, даже при ошибках
 */
app.get(['/api/nfts/:address', '/nfts/:address'], async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`[API] Получаем NFT для ${address}`);
    
    // Параллельно получаем NFT из кошелька и застейканные в HOT
    const [walletResult, hotResult] = await Promise.allSettled([
      getNFTBalance(address),
      getHotStakedNFTs(address),
    ]);
    
    // Обрабатываем результаты с fail-safe
    const walletNFTs = walletResult.status === 'fulfilled' ? walletResult.value : [];
    const hotStakedNFTs = hotResult.status === 'fulfilled' ? hotResult.value : [];
    
    // Определяем ошибку если она была
    const hasError = walletResult.status === 'rejected' || hotResult.status === 'rejected';
    const errorMessage = hasError 
      ? (walletResult.reason?.message || hotResult.reason?.message || 'NFT_LOAD_FAILED')
      : null;
    
    res.json({
      address,
      wallet: walletNFTs,
      hotStaked: hotStakedNFTs,
      total: walletNFTs.length + hotStakedNFTs.length,
      error: errorMessage,
      timestamp: Date.now(),
    });
  } catch (error) {
    // FAIL-SAFE: Возвращаем 200 OK с пустыми данными
    console.error('[API] Критическая ошибка в /api/nfts:', error.message);
    res.status(200).json({
      address: req.params.address,
      wallet: [],
      hotStaked: [],
      total: 0,
      error: 'NFT_CRITICAL_ERROR',
      message: error.message,
      timestamp: Date.now(),
    });
  }
});

/**
 * POST /api/nfts/spam и /nfts/spam
 * Помечает NFT как спам
 */
app.post(['/api/nfts/spam', '/nfts/spam'], async (req, res) => {
  try {
    const { address, nftIds } = req.body;
    
    if (!address || !nftIds || !Array.isArray(nftIds)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Required fields: address (string), nftIds (array)',
      });
    }
    
    console.log(`[API] Помечаем ${nftIds.length} NFT как спам для ${address}`);
    
    // В простой версии просто возвращаем успех
    // В будущем можно добавить сохранение в БД
    res.json({
      success: true,
      address,
      spammedCount: nftIds.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API] Ошибка в /api/nfts/spam:', error.message);
    res.status(500).json({
      error: 'Failed to mark as spam',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/nfts/spam и /nfts/spam
 * Восстанавливает NFT из спама
 */
app.delete(['/api/nfts/spam', '/nfts/spam'], async (req, res) => {
  try {
    const { address, nftIds } = req.body;
    
    if (!address || !nftIds || !Array.isArray(nftIds)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Required fields: address (string), nftIds (array)',
      });
    }
    
    console.log(`[API] Восстанавливаем ${nftIds.length} NFT из спама для ${address}`);
    
    res.json({
      success: true,
      address,
      restoredCount: nftIds.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[API] Ошибка в /api/nfts/spam:', error.message);
    res.status(500).json({
      error: 'Failed to restore from spam',
      message: error.message,
    });
  }
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
      'GET /api/transactions/:address?limit=10 - Get transaction history',
      'GET /api/hot-claim/:address - Get HOT claim status',
      'GET /api/analytics/:address?period=week - Get transaction analytics (period: week, month, all)',
      'GET /api/nfts/:address - Get user NFTs (wallet + HOT staked)',
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
