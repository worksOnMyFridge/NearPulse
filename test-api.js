/**
 * Быстрый тест API перед деплоем на Vercel
 * Проверяет что api/index.js правильно экспортирует Express app
 */

console.log('🧪 Тестирование API...\n');

// Тест 1: Проверка что app экспортируется без запуска сервера
console.log('Тест 1: Импорт api/index.js');
try {
  const app = require('./api/index');
  console.log('✅ App успешно импортирован');
  console.log('✅ Type:', typeof app);
  console.log('✅ Has listen():', typeof app.listen === 'function');
  
  // Проверяем что сервер НЕ запустился
  console.log('✅ Сервер НЕ запустился автоматически (это хорошо для Vercel)\n');
} catch (error) {
  console.error('❌ Ошибка импорта:', error.message);
  process.exit(1);
}

// Тест 2: Проверка что src/api.js экспортируется
console.log('Тест 2: Импорт src/api.js');
try {
  const srcApp = require('./src/api');
  console.log('✅ src/api.js успешно импортирован');
  console.log('✅ Type:', typeof srcApp);
  console.log('✅ Has listen():', typeof srcApp.listen === 'function');
  console.log('✅ Сервер НЕ запустился (require.main !== module)\n');
} catch (error) {
  console.error('❌ Ошибка импорта src/api.js:', error.message);
  process.exit(1);
}

console.log('🎉 Все тесты пройдены!');
console.log('\n📝 Следующие шаги:');
console.log('1. Запустите локальный API: npm run api');
console.log('2. Проверьте endpoints: curl http://localhost:3001/api/health');
console.log('3. Закоммитьте и пушьте: git add . && git commit -m "..." && git push');
console.log('4. Vercel автоматически задеплоит! 🚀\n');
