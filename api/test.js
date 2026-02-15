/**
 * Простейшая тестовая Vercel функция
 * Для проверки что Functions вообще работают
 */

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.status(200).json({
    status: 'ok',
    message: 'Test Vercel Function works! ✅',
    timestamp: Date.now(),
    path: req.url,
    method: req.method,
  });
};
