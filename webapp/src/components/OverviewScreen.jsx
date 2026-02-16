import { useState, useEffect } from 'react';
import { Activity, Zap, Sparkles, TrendingUp, BarChart3, PieChart, Wallet, Info } from 'lucide-react';
import { fetchAnalytics } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';
import { useTheme } from '../contexts/ThemeContext';

export default function OverviewScreen({ selectedPeriod, onPeriodChange, balanceData }) {
  const { address } = useTelegram();
  const { theme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState('');
  const [data, setData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const displayAddress = address || 'leninjiv23.tg';

  // Нормализация balanceData — поддержка обоих форматов API
  // API возвращает: { near: 12.45, staking: 50, hot: 2500, nearPrice: 3.5, hotClaim: {...} }
  // Компонент ожидал: { near: { total, usdValue }, hot: { amount } }
  const nearTotal = balanceData
    ? (typeof balanceData.near === 'object' ? balanceData.near?.total : (balanceData.near || 0) + (balanceData.staking || 0))
    : 0;
  const nearPrice = balanceData?.nearPrice || 0;
  const nearUsd = nearTotal * nearPrice;
  const hotAmount = balanceData
    ? (typeof balanceData.hot === 'object' ? balanceData.hot?.amount : balanceData.hot) || 0
    : 0;

  // HOT claim status из balanceData.hotClaim (приходит вместе с балансом)
  const claimStatus = balanceData?.hotClaim || null;

  // Загрузка аналитики
  useEffect(() => {
    async function loadAnalytics() {
      try {
        setAnalyticsLoading(true);
        const analytics = await fetchAnalytics(displayAddress, selectedPeriod);
        setData(analytics);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setData(null);
      } finally {
        setAnalyticsLoading(false);
      }
    }
    loadAnalytics();
  }, [displayAddress, selectedPeriod]);

  // Таймер HOT — поддержка обоих форматов
  // Формат 1 (Python API): { readyToClaim: bool, hoursUntilClaim, minutesUntilClaim }
  // Формат 2 (legacy): { nextClaimTime: timestamp, canClaim: bool }
  useEffect(() => {
    if (!claimStatus) {
      setTimeRemaining('');
      return;
    }

    // Формат Python API
    if ('readyToClaim' in claimStatus) {
      if (claimStatus.readyToClaim) {
        setTimeRemaining('Можно клеймить!');
      } else {
        const h = claimStatus.hoursUntilClaim || 0;
        const m = claimStatus.minutesUntilClaim || 0;
        setTimeRemaining(h > 0 ? `${h}ч ${m}м` : `${m}м`);
      }
      return;
    }

    // Формат legacy (nextClaimTime)
    if (!claimStatus.nextClaimTime) {
      setTimeRemaining('');
      return;
    }
    const updateTimer = () => {
      const now = Date.now();
      const diff = claimStatus.nextClaimTime - now;
      if (diff <= 0) {
        setTimeRemaining('Можно клеймить!');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(hours > 0 ? `${hours}ч ${minutes}м ${seconds}с` : `${minutes}м ${seconds}с`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [claimStatus]);

  const maxActivity = data?.activityByDay ? Math.max(...data.activityByDay.map(d => d.txs), 1) : 1;

  const canClaim = claimStatus?.readyToClaim || claimStatus?.canClaim || false;

  const generateInsights = () => {
    if (!data) return [];
    const insights = [...(data.insights || [])];
    if (hotAmount > 0) {
      const hotFormatted = hotAmount.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
      const tokenIdx = insights.findIndex(i => i.text.includes('MOON'));
      if (tokenIdx !== -1) insights[tokenIdx] = { type: 'success', text: `HOT баланс: ${hotFormatted} токенов`, icon: '🔥' };
    }
    if (nearTotal > 0) {
      const nearFormatted = nearTotal.toFixed(2);
      const nearUsdStr = nearUsd > 0 ? ` (~$${nearUsd.toFixed(2)})` : '';
      insights.unshift({ type: 'info', text: `NEAR баланс: ${nearFormatted} NEAR${nearUsdStr}`, icon: '💰' });
    }
    return insights;
  };

  const insights = generateInsights();
  const categoryLabels = { gaming: '🕹 Gaming', defi: '💰 DeFi', transfers: '📤 Переводы', nft: '🎨 NFT' };
  const categoryColors = { gaming: 'bg-purple-500', defi: 'bg-green-500', transfers: 'bg-blue-500', nft: 'bg-pink-500' };

  return (
    <div className="space-y-4">
      {/* Карточка портфеля */}
      {balanceData && (
        <button
          className={`w-full rounded-2xl p-5 transition-all transform hover:scale-[1.02] text-left relative overflow-hidden ${
            theme === 'light'
              ? 'bg-white border-2 border-[#00C1DE] shadow-[0_20px_50px_rgba(0,193,222,0.3)]'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl'
          }`}
        >
          <div className={theme === 'light' ? 'text-slate-900' : 'text-white'}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <div className="text-sm opacity-90 font-medium">Портфель</div>
              </div>
              <Info className="w-4 h-4 opacity-50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs opacity-75 mb-1">NEAR</div>
                <div className="text-2xl font-bold">{nearTotal.toFixed(2)}</div>
                {nearUsd > 0 && <div className="text-xs opacity-75">${nearUsd.toFixed(2)}</div>}
              </div>
              <div>
                <div className="text-xs opacity-75 mb-1">HOT</div>
                <div className="text-2xl font-bold">{hotAmount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</div>
                <div className="text-xs opacity-75">токенов</div>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Таймер HOT */}
      {claimStatus && (
        <div className={`rounded-xl p-4 border-2 transition-all ${
          canClaim ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white border-orange-600 shadow-lg' : 'glass-card border-glass text-primary'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{canClaim ? '🔥' : '⏰'}</div>
              <div>
                <div className="text-sm font-semibold">{canClaim ? 'HOT готов!' : 'Следующий клейм HOT'}</div>
                <div className="text-xs opacity-90">{canClaim ? 'Откройте бота' : 'Осталось времени'}</div>
              </div>
            </div>
            <div className="text-right font-bold font-mono text-lg">{timeRemaining || '...'}</div>
          </div>
        </div>
      )}

      {/* Инсайты */}
      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <div key={idx} className="glass-card rounded-xl p-4 flex items-start gap-3">
            <div className="text-2xl">{insight.icon}</div>
            <div className="text-sm font-medium text-primary">{insight.text}</div>
          </div>
        ))}
      </div>

      {/* Статистика */}
      {!analyticsLoading && data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-500/20">
            <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 opacity-80" /><div className="text-xs opacity-80">Транзакций</div></div>
            <div className="text-3xl font-bold">{data.totalTxs}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-4 text-white shadow-lg shadow-orange-500/20">
            <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 opacity-80" /><div className="text-xs opacity-80">Gas (NEAR)</div></div>
            <div className="text-3xl font-bold">{data.gasSpent.toFixed(3)}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 opacity-80" /><div className="text-xs opacity-80">Контрактов</div></div>
            <div className="text-3xl font-bold">{data.uniqueContracts}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 opacity-80" /><div className="text-xs opacity-80">Топ протокол</div></div>
            <div className="text-lg font-bold truncate">{data.mostActive}</div>
          </div>
        </div>
      )}

      {/* Графики и Протоколы */}
      {!analyticsLoading && data && (
        <>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-primary">Активность</h3><BarChart3 className="w-5 h-5 text-secondary" /></div>
            <div className="flex items-end justify-between gap-2 h-32">
              {data.activityByDay.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-glass rounded-t-lg relative h-full">
                    <div className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all" style={{ height: `${maxActivity > 0 ? (day.txs / maxActivity) * 100 : 0}%` }} />
                  </div>
                  <div className="text-[10px] text-secondary">{day.day}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-primary">По категориям</h3><PieChart className="w-5 h-5 text-secondary" /></div>
            <div className="space-y-3">
              {Object.entries(data.breakdown).filter(([, val]) => val.count > 0).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-primary">{categoryLabels[key]}</span><span className="font-bold">{val.percent}%</span></div>
                  <div className="w-full bg-glass rounded-full h-2"><div className={`h-2 rounded-full ${categoryColors[key]}`} style={{ width: `${val.percent}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Топ протоколы */}
          {data.topContracts?.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <h3 className="font-semibold text-primary mb-3">Топ протоколы</h3>
              <div className="space-y-2">
                {data.topContracts.map((contract, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 glass-subtle rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{contract.icon}</div>
                      <div>
                        <div className="font-medium text-sm text-primary">{contract.name}</div>
                        <div className="text-xs text-secondary">{contract.category}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-primary">{contract.txs} txs</div>
                      <div className="text-xs text-secondary">{contract.gas.toFixed(3)} N</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
