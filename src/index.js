require('dotenv/config');

const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не задан в .env');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.start((ctx) => {
  ctx.reply(
    '👋 Привет! Я NearPulse — бот для аналитики NEAR кошельков\n\nКоманды:\n/help - Помощь'
  );
});

bot.help((ctx) => {
  ctx.reply(
    '📋 Доступные команды:\n/start - Начать работу\n/help - Эта справка'
  );
});

async function main() {
  try {
    await bot.launch();
    console.log('NearPulse bot started');
  } catch (error) {
    console.error('Ошибка запуска бота:', error.message);
    process.exit(1);
  }
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

main();
