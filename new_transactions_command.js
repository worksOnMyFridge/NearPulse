// Новая упрощённая команда /transactions

bot.command('transactions', async (ctx) => {
  const address = ctx.message.text.split(' ')[1];

  if (!address) {
    await ctx.reply('📍 Пожалуйста, укажите адрес. Пример: /transactions vlad.near');
    return;
  }

  try {
    const loadingMsg = await ctx.reply('⏳ Загружаю историю транзакций...');

    const [txns, nearPrice] = await Promise.all([
      getTransactionHistory(address),
      getNearPrice().catch(() => null),
    ]);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    if (!Array.isArray(txns) || txns.length === 0) {
      await ctx.reply('📭 История транзакций пуста или недоступна.');
      return;
    }

    const formatNum = (n) =>
      n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatUsd = (nearAmount) => {
      if (!nearPrice || !nearAmount || nearAmount < 0.01) return '';
      const usd = nearAmount * nearPrice;
      return ` (~$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    };

    // Группируем по transaction_hash и берём только последние 5
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
      .slice(0, 5); // Только последние 5

    let message = `${APPLE_STYLE_HEADER}\n` +
                  `📜 **Последние транзакции**\n` +
                  `👤 **Аккаунт:** \`${address}\`\n` +
                  '━━━━━━━━━━━━━━━━━━\n\n';

    uniqueTxns.forEach((txGroup, index) => {
      const group = txGroup.transactions;
      const relevantTxs = group.filter(tx => 
        tx.receiver_account_id !== 'system' && 
        tx.predecessor_account_id !== 'system'
      );

      if (relevantTxs.length === 0) return;

      const firstTx = relevantTxs[0];
      const timestamp = parseInt(firstTx.block_timestamp) / 1000000; // nanoseconds to ms
      const timeAgo = dayjs(timestamp).fromNow();

      // Определяем тип транзакции
      const contracts = relevantTxs.map(tx => tx.receiver_account_id);
      let totalNear = 0;
      
      relevantTxs.forEach(tx => {
        const deposit = tx.actions_agg?.deposit ? parseFloat(tx.actions_agg.deposit) / 1e24 : 0;
        if (tx.predecessor_account_id === address) {
          totalNear += deposit;
        } else if (tx.receiver_account_id === address) {
          totalNear -= deposit; // входящий
        }
      });

      const hasHot = contracts.some(c => c.includes('hot.tg') || c === 'game.hot.tg');
      const hasMoon = contracts.some(c => c.includes('harvest-moon'));
      const hasRef = contracts.some(c => c.includes('ref-finance'));
      const hasRhea = contracts.some(c => c.includes('rhea'));
      const hasTokenTransfer = contracts.some(c => 
        c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking')
      );

      let icon = '';
      let description = '';
      let showAmount = false;
      let displayAmount = Math.abs(totalNear);

      // 🔥 HOT Claim
      if (hasHot) {
        icon = '🔥';
        description = 'Claim HOT';
        showAmount = false;
      }
      // 🎁 Другие claims
      else if (hasMoon) {
        icon = '🎁';
        description = 'Claim MOON';
        showAmount = false;
      }
      // 🔄 Swap
      else if ((hasRef || hasRhea) && relevantTxs.length > 1) {
        icon = '🔄';
        description = hasRef ? 'Swap (Ref Finance)' : 'Swap (RHEA)';
        showAmount = displayAmount > 0.01;
      }
      // 📥 📤 NEAR Transfer
      else if (displayAmount > 0.01 && !hasTokenTransfer) {
        const isOutgoing = totalNear > 0;
        icon = isOutgoing ? '📤' : '📥';
        const otherParty = isOutgoing ? firstTx.receiver_account_id : firstTx.predecessor_account_id;
        
        // Сокращаем длинные адреса
        let shortAddress = otherParty;
        if (otherParty.length > 20) {
          shortAddress = otherParty.substring(0, 17) + '...';
        }
        
        description = isOutgoing ? `Отправлено → ${shortAddress}` : `Получено ← ${shortAddress}`;
        showAmount = true;
      }
      // 🪙 Token Transfer
      else if (hasTokenTransfer) {
        const tokenContract = contracts.find(c => 
          c.includes('.tkn.') || c.includes('token.') || c.includes('meme-cooking')
        );
        
        let tokenName = 'TOKEN';
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
        icon = isOutgoing ? '📤' : '📥';
        description = isOutgoing ? `Отправлено ${tokenName}` : `Получено ${tokenName}`;
        showAmount = false;
      }
      // 📝 Contract Call
      else {
        icon = '📝';
        description = 'Вызов контракта';
        showAmount = displayAmount > 0.01;
      }

      // Формируем вывод (2-3 строки)
      message += `${icon} **${description}**\n`;
      
      if (showAmount) {
        message += `💰 **${formatNum(displayAmount)} NEAR**${formatUsd(displayAmount)}\n`;
      }
      
      message += `🕒 ${timeAgo}\n`;

      // Добавляем разделитель между транзакциями
      if (index < uniqueTxns.length - 1) {
        message += '\n';
      }
    });

    message += '\n━━━━━━━━━━━━━━━━━━';

    await ctx.replyWithMarkdown(message);

  } catch (error) {
    console.error('Ошибка в /transactions:', error.message);
    await ctx.reply('❌ Не удалось загрузить транзакции. Попробуйте позже.');
  }
});
