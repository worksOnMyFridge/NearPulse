require('dotenv/config');

const { Telegraf } = require('telegraf');
const { getBalance } = require('./services/nearService');

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
    '📋 Доступные команды:\n/start - Начать работу\n/help - Эта справка\n/balance <адрес> - Баланс кошелька'
  );
});

bot.command('balance', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];
  if (!address) {
    await ctx.reply('Укажите адрес: /balance vlad.near');
    return;
  }
  try {
    await ctx.reply('⏳ Загружаю данные...');
    const balance = await getBalance(address);
    await ctx.reply(`💰 Баланс ${address}\n\n${balance.near} NEAR`);
  } catch (error) {
    await ctx.reply('❌ Адрес не найден');
  }
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
