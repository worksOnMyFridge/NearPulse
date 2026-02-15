import { useState, useEffect } from 'react';
import { Activity, Zap, Sparkles, TrendingUp, BarChart3, PieChart, Wallet, Clock, Info, Image } from 'lucide-react';
import { fetchHotClaimStatus, fetchAnalytics } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';

export default function OverviewScreen({ selectedPeriod, onPeriodChange, balanceData }) {
  const { address } = useTelegram();
  const [claimStatus, setClaimStatus] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [data, setData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  // NFT state удалён - больше не используется
  // const [nfts, setNfts] = useState(null);
  // const [nftsLoading, setNftsLoading] = useState(true);
  
  const displayAddress = address || 'leninjiv23.tg';

  // Загружаем статус клейма
  useEffect(() => {
    async function loadClaimStatus() {
      try {
        const status = await fetchHotClaimStatus(displayAddress);
        setClaimStatus(status);
      } catch (err) {
        console.error('Error loading HOT claim status:', err);
      }
    }

    loadClaimStatus();
    // Обновляем каждые 30 секунд
    const interval = setInterval(loadClaimStatus, 30000);
    return () => clearInterval(interval);
  }, [displayAddress]);

  // Загружаем аналитику
  useEffect(() => {
    async function loadAnalytics() {
      try {
        setAnalyticsLoading(true);
        const analytics = await fetchAnalytics(displayAddress, selectedPeriod);
        setData(analytics);
      } catch (err) {
        console.error('Error loading analytics:', err);
        // Используем пустую аналитику при ошибке
        setData(null);
      } finally {
        setAnalyticsLoading(false);
      }
    }

    loadAnalytics();
  }, [displayAddress, selectedPeriod]);

  // NFT отключены - загружаются только в Галерее вручную
  // useEffect(() => {
  //   async function loadNFTs() {
  //     try {
  //       setNftsLoading(true);
  //       const nftData = await fetchNFTs(displayAddress);
  //       setNfts(nftData);
  //     } catch (err) {
  //       console.error('Error loading NFTs:', err);
  //       setNfts(null);
  //     } finally {
  //       setNftsLoading(false);
  //     }
  //   }
  //   loadNFTs();
  // }, [displayAddress]);

  // Обновляем таймер каждую секунду
  useEffect(() => {
    if (!claimStatus || !claimStatus.nextClaimTime) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const nextClaim = claimStatus.nextClaimTime;
      const diff = nextClaim - now;

      if (diff <= 0) {
        setTimeRemaining('Можно клеймить! 🎉');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}ч ${minutes}м ${seconds}с`);
      } else {
        setTimeRemaining(`${minutes}м ${seconds}с`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [claimStatus]);
  
  // Если аналитика ещё загружается или отсутствует, используем значения по умолчанию
  const maxActivity = data?.activityByDay ? Math.max(...data.activityByDay.map(d => d.txs), 1) : 1;

  // Генерируем insights с реальными данными
  const generateInsights = () => {
    if (!data) return [];
    
    const insights = [...(data.insights || [])];
    
    // Заменяем insight с MOON токенами на реальный HOT баланс
    if (balanceData && balanceData.hot) {
      const hotAmount = balanceData.hot.amount.toLocaleString('ru-RU', {
        maximumFractionDigits: 0
      });
      
      // Находим и заменяем insight про токены
      const tokenInsightIndex = insights.findIndex(i => i.text.includes('MOON'));
      if (tokenInsightIndex !== -1) {
        insights[tokenInsightIndex] = {
          type: 'success',
          text: `HOT баланс: ${hotAmount} токенов`,
          icon: '🔥'
        };
      }
    }
    
    // Добавляем insight с балансом NEAR
    if (balanceData && balanceData.near) {
      const nearTotal = balanceData.near.total.toFixed(2);
      const nearUsd = balanceData.near.usdValue 
        ? ` (~$${balanceData.near.usdValue.toFixed(2)})`
        : '';
      
      insights.unshift({
        type: 'info',
        text: `NEAR баланс: ${nearTotal} NEAR${nearUsd}`,
        icon: '💰'
      });
    }
    
    return insights;
  };
  
  const insights = generateInsights();

  const categoryLabels = {
    gaming: '\u{1F3AE} Gaming',
    defi: '\u{1F4B0} DeFi',
    transfers: '\u{1F4E4} Переводы',
    nft: '\u{1F3A8} NFT',
  };

  const categoryColors = {
    gaming: 'bg-purple-500',
    defi: 'bg-green-500',
    transfers: 'bg-blue-500',
    nft: 'bg-pink-500',
  };

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'week', label: '7 дней' },
          { key: 'month', label: '30 дней' },
          { key: 'all', label: 'Всё время' },
        ].map(period => (
          <button
            key={period.key}
            onClick={() => onPeriodChange(period.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedPeriod === period.key
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'glass-card text-primary hover:scale-105'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Balance Card - кликабельная с иконкой info */}
      {balanceData && (
        <button className="w-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white glass-card hover:scale-[1.02] transition-transform group text-left">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              <div className="text-sm opacity-90 font-medium">Портфель</div>
            </div>
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Info className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs opacity-75 mb-1">NEAR</div>
              <div className="text-2xl font-bold">{balanceData.near.total.toFixed(2)}</div>
              {balanceData.near.usdValue && (
                <div className="text-xs opacity-75">${balanceData.near.usdValue.toFixed(2)}</div>
              )}
            </div>
            <div>
              <div className="text-xs opacity-75 mb-1">HOT</div>
              <div className="text-2xl font-bold">
                {balanceData.hot.amount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs opacity-75">токенов</div>
            </div>
          </div>
        </button>
      )}

      {/* HOT Claim Timer - с glassmorphism */}
      {claimStatus && (
        <div className={`rounded-xl p-4 border-2 transition-all ${
          claimStatus.canClaim 
            ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white border-orange-600 shadow-lg shadow-orange-500/30 glow-hot' 
            : 'glass-card border-glass text-primary'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{claimStatus.canClaim ? '🔥' : '⏰'}</div>
              <div>
                <div className={`text-sm font-semibold ${claimStatus.canClaim ? 'text-white' : 'text-primary'}`}>
                  {claimStatus.canClaim ? 'HOT готов к клейму!' : 'Следующий клейм HOT'}
                </div>
                <div className={`text-xs ${claimStatus.canClaim ? 'text-white opacity-90' : 'text-secondary'}`}>
                  {claimStatus.canClaim ? 'Откройте бота чтобы получить' : 'Осталось времени'}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className={`flex items-center gap-1 ${claimStatus.canClaim ? 'text-white' : 'text-primary'}`}>
                {!claimStatus.canClaim && <Clock className="w-4 h-4" />}
                <div className="text-lg font-bold font-mono">
                  {timeRemaining || '...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <div key={idx} className="glass-card rounded-xl p-4 flex items-start gap-3 hover:scale-[1.01] transition-transform">
            <div className="text-2xl">{insight.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-primary">{insight.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Stats */}
      {!analyticsLoading && data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 opacity-80" />
              <div className="text-xs opacity-80">Транзакций</div>
            </div>
            <div className="text-3xl font-bold">{data.totalTxs}</div>
            <div className="text-xs opacity-80 mt-1">за период</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 opacity-80" />
              <div className="text-xs opacity-80">Gas расходы</div>
            </div>
            <div className="text-3xl font-bold">{data.gasSpent.toFixed(3)}</div>
            <div className="text-xs opacity-80 mt-1">NEAR (${data.gasUSD})</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 opacity-80" />
              <div className="text-xs opacity-80">Контрактов</div>
            </div>
            <div className="text-3xl font-bold">{data.uniqueContracts}</div>
            <div className="text-xs opacity-80 mt-1">уникальных</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg shadow-green-500/20 hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 opacity-80" />
              <div className="text-xs opacity-80">Самый активный</div>
            </div>
            <div className="text-lg font-bold mt-2">{data.mostActive}</div>
            <div className="text-xs opacity-80">протокол</div>
          </div>
        </div>
      )}

      {/* Activity Chart */}
      {!analyticsLoading && data && (
        <>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-primary">Активность по дням</h3>
              <BarChart3 className="w-5 h-5 text-secondary" />
            </div>

            <div className="flex items-end justify-between gap-2 h-32">
              {data.activityByDay.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-glass rounded-t-lg relative" style={{ height: '100%' }}>
                    <div
                      className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all hover:from-blue-400 hover:to-blue-300"
                      style={{ height: `${maxActivity > 0 ? (day.txs / maxActivity) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-secondary font-medium">{day.day}</div>
                  <div className="text-xs font-bold text-primary">{day.txs}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-primary">По категориям</h3>
              <PieChart className="w-5 h-5 text-secondary" />
            </div>

            <div className="space-y-3">
              {Object.entries(data.breakdown).filter(([, val]) => val.count > 0).map(([key, val]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-primary">{categoryLabels[key]}</div>
                      <div className="text-xs text-secondary">{val.count} txs</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{val.percent}%</div>
                  </div>
                  <div className="w-full bg-glass rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${categoryColors[key]}`}
                      style={{ width: `${val.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Contracts */}
          {data.topContracts.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <h3 className="font-semibold text-primary mb-3">Топ протоколы</h3>

              <div className="space-y-2">
                {data.topContracts.map((contract, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 glass-subtle rounded-lg hover:bg-glass-hover transition cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{contract.icon}</div>
                      <div>
                        <div className="font-medium text-sm text-primary">{contract.name}</div>
                        <div className="text-xs text-secondary">{contract.category}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-primary">{contract.txs} txs</div>
                      <div className="text-xs text-secondary">{contract.gas.toFixed(3)} N gas</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* NFT Section - ОТКЛЮЧЕНО для стабильности */}
      {/* {!nftsLoading && nfts && nfts.total > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="text-center">
            <div className="text-4xl mb-2">🎨</div>
            <div className="text-primary font-medium mb-1">NFT Галерея</div>
            <div className="text-secondary text-sm">Доступна на вкладке "Галерея"</div>
          </div>
        </div>
      )} */}
    </div>
  );
}
