/**
 * Скрипт для замены старой команды /transactions на новую
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'src', 'index.js');
const newCommandPath = path.join(__dirname, 'new_transactions_command.js');

console.log('🔄 Замена команды /transactions...');

// Читаем файлы
const indexContent = fs.readFileSync(indexPath, 'utf8');
const newCommand = fs.readFileSync(newCommandPath, 'utf8')
  .replace(/^\/\/ Новая упрощённая команда \/transactions\n\n/, ''); // Убираем комментарий

// Находим начало и конец старой команды
const startMarker = '// Временное хранилище деталей транзакций\nconst txDetailsCache = new Map();\n\nbot.command(\'transactions\'';
const endMarker = '});\n\nbot.command(\'pulse\'';

const startIndex = indexContent.indexOf(startMarker);
const endIndex = indexContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('❌ Не найдены маркеры начала/конца команды');
  process.exit(1);
}

// Собираем новый контент
const before = indexContent.substring(0, startIndex);
const after = indexContent.substring(endIndex);

const newContent = before + 
  '// Временное хранилище деталей транзакций\n' +
  'const txDetailsCache = new Map();\n\n' +
  newCommand + '\n\n' +
  after.substring(5); // Убираем лишний перенос строки

// Сохраняем
fs.writeFileSync(indexPath, newContent, 'utf8');

console.log('✅ Команда /transactions успешно заменена!');
console.log('📊 Новая команда:');
console.log('  - Показывает только 5 последних транзакций');
console.log('  - Красивые эмодзи: 📥 📤 🔥');
console.log('  - Время в формате "15 минут назад" (dayjs)');
console.log('  - USD цены для NEAR транзакций');
console.log('  - Компактный вывод (2-3 строки)');
console.log('');
console.log('💾 Файл сохранён: src/index.js');
console.log('');
console.log('🚀 Теперь запустите: deploy-transactions.bat');
