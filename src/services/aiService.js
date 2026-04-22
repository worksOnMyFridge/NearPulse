const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут

const cache = new Map(); // address -> { report, expiresAt }

// Mock-отчёты для режима без лимитов ИИ (тесты дизайна)
const MOCK_REPORTS = [
  'Ваша активность в NEAR выглядит стабильно. Регулярные переводы и стейкинг формируют здоровый портфель. Продолжайте в том же духе.',
  'Кошелёк демонстрирует умеренную активность. Баланс в безопасности, стейкинг работает как часы. Ваши активы под контролем.',
  'Транзакции в норме. NEAR-экосистема на вашей стороне. Ваш портфель готов к новым возможностям.',
];

/**
 * Преобразует технический список транзакций в короткий вдохновляющий отчёт
 * в стиле Apple Finance (3–4 предложения).
 * @param {Array} transactions - массив транзакций от Nearblocks API
 * @param {string} address - NEAR-адрес (ключ кэша)
 * @returns {Promise<string>} - отчёт на русском языке
 */
async function generatePulseReport(transactions, address) {
  if (address) {
    const cached = cache.get(address);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.report;
    }
  }

  if (!apiKey) {
    return getRandomMockReport();
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Ты — финансовый аналитик в стиле Apple Finance. Твой стиль: минимализм, ясность, вдохновение.

Дан список последних транзакций NEAR-кошелька (технический формат):
${JSON.stringify(transactions, null, 2)}

Напиши короткий отчёт (3–4 предложения) на русском языке:
- Что происходит с кошельком (переводы, стейкинг, DeFi, NFT и т.д.)
- Общий тон активности
- Краткая мотивирующая концовка в духе Apple

Не используй эмодзи. Пиши простым языком. Без заголовков и списков.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = (response.text() || '').trim() || 'Недостаточно данных для анализа.';

    if (address) {
      cache.set(address, { report: text, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return text;
  } catch (error) {
    const status = error.response?.status ?? error.status ?? error.code;
    const msg = (error.message || '').toLowerCase();

    if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
      return getRandomMockReport();
    }

    // Любая другая ошибка API — возвращаем mock для тестов дизайна
    console.error('generatePulseReport error:', error.message);
    return getRandomMockReport();
  }
}

function getRandomMockReport() {
  const idx = Math.floor(Math.random() * MOCK_REPORTS.length);
  return MOCK_REPORTS[idx];
}

module.exports = { generatePulseReport };
