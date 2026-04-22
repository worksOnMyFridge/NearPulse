export const analytics = {
  week: {
    totalTxs: 47,
    gasSpent: 0.12,
    gasUSD: 0.13,
    uniqueContracts: 8,
    mostActive: 'Hot Protocol',
    insights: [
      { type: 'info', text: 'Вы на 30% активнее чем обычно', icon: '\u{1F4C8}' },
      { type: 'warning', text: 'Gas расходы выше среднего на 15%', icon: '\u26A0\uFE0F' },
      { type: 'success', text: 'Получено 45,000 MOON токенов', icon: '\u{1F389}' }
    ],
    breakdown: {
      gaming: { count: 28, percent: 60, usd: 0 },
      defi: { count: 12, percent: 26, usd: 5.47 },
      transfers: { count: 5, percent: 10, usd: 25.00 },
      nft: { count: 2, percent: 4, usd: 0 }
    },
    topContracts: [
      { name: 'Hot Protocol', icon: '\u{1F525}', txs: 20, gas: 0.05, category: 'Gaming' },
      { name: 'Moon Protocol', icon: '\u{1F319}', txs: 15, gas: 0.03, category: 'Gaming' },
      { name: 'Ref Finance', icon: '\u{1F4B1}', txs: 8, gas: 0.02, category: 'DeFi' },
      { name: 'wrap.near', icon: '\u{1F381}', txs: 4, gas: 0.02, category: 'DeFi' }
    ],
    activityByDay: [
      { day: 'Пн', txs: 5 },
      { day: 'Вт', txs: 8 },
      { day: 'Ср', txs: 12 },
      { day: 'Чт', txs: 9 },
      { day: 'Пт', txs: 7 },
      { day: 'Сб', txs: 3 },
      { day: 'Вс', txs: 3 }
    ]
  }
};

export const transactions = [
  {
    id: 1,
    type: 'claim',
    protocol: 'Moon Protocol',
    action: 'Claim MOON',
    icon: '\u{1F381}',
    time: '1ч 39м назад',
    gas: 0.002,
    result: '+5,000 MOON',
    category: 'Gaming',
    txCount: 2,
    grouped: [
      { action: 'Call claim_rewards', contract: 'moon.protocol.near', gas: 0.001 },
      { action: 'Transfer tokens', contract: 'token.moon.near', gas: 0.001 }
    ]
  },
  {
    id: 2,
    type: 'swap',
    protocol: 'Ref Finance',
    action: 'Swap USDT \u2192 NEAR',
    icon: '\u{1F4B1}',
    time: '2ч 15м назад',
    gas: 0.008,
    result: '+4.8 NEAR',
    input: '100 USDT',
    category: 'DeFi',
    txCount: 4,
    grouped: [
      { action: 'Approve USDT', contract: 'usdt.token.near', gas: 0.002 },
      { action: 'Deposit to pool', contract: 'v2.ref-finance.near', gas: 0.002 },
      { action: 'Execute swap', contract: 'v2.ref-finance.near', gas: 0.003 },
      { action: 'Withdraw NEAR', contract: 'v2.ref-finance.near', gas: 0.001 }
    ]
  },
  {
    id: 3,
    type: 'claim',
    protocol: 'Hot Protocol',
    action: 'Claim HOT',
    icon: '\u{1F525}',
    time: '6ч 10м назад',
    gas: 0.002,
    result: '+2,500 HOT',
    category: 'Gaming',
    txCount: 1
  },
  {
    id: 4,
    type: 'transfer',
    protocol: 'NEAR Transfer',
    action: 'Перевод на wrap.near',
    icon: '\u{1F4E4}',
    time: '1д назад',
    gas: 0.001,
    result: '-5.00 NEAR',
    category: 'Transfers',
    txCount: 1
  }
];
