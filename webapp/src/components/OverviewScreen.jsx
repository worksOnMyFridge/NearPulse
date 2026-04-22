import { useState, useEffect } from 'react';
import { Activity, Zap, Sparkles, TrendingUp, BarChart3, PieChart, Wallet, Info } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { fetchAnalytics } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';
import { useTheme } from '../contexts/ThemeContext';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nearpulse.onrender.com';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 shadow-lg text-xs"
      style={{ background: 'var(--accent-primary)', color: '#fff' }}>
      <div className="font-bold">{payload[0].value?.toFixed(2)} NEAR</div>
      <div className="opacity-75">{label}</div>
    </div>
  );
}

function PortfolioChart({ address }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState('7d');
  const [change, setChange]       = useState(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`${API_BASE}/api/portfolio-history/${address}?period=${period}`)
      .then(r => r.json())
      .then(data => {
        const points = data.history || [];
        setChartData(points);
        if (points.length >= 2) {
          const first = points[0].near;
          const last  = points[points.length - 1].near;
          const diff  = last - first;
          const pct   = first > 0 ? (diff / first * 100) : 0;
          setChange({ diff, pct, up: diff >= 0 });
        } else {
          setChange(null);
        }
      })
      .catch(() => setChartData([]))
      .finally(() => setLoading(false));
  }, [address, period]);

  const periods = [
    { key: '7d',  label: '7д'  },
    { key: '14d', label: '14д' },
    { key: '30d', label: '30д' },
  ];

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4">
        <h3 className="font-semibold text-primary mb-3">📉 График баланса</h3>
        <div className="flex items-center justify-center h-28">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="glass-card rounded-xl p-4">
        <h3 className="font-semibold text-primary mb-2">📉 График баланса</h3>
        <div className="text-xs text-secondary text-center py-4">
          Данных пока нет — они накапливаются при каждом открытии баланса
        </div>
      </div>
    );
  }

  const sign  = change?.up ? '+' : '';
  const color = change?.up ? 'var(--color-positive)' : 'var(--color-negative)';

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-primary">📉 График NEAR</h3>
        <div className="flex gap-1">
          {periods.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              style={{
                background: period === p.key ? 'var(--accent-primary)' : 'transparent',
                color: period === p.key ? '#fff' : 'var(--text-tertiary)',
                border: 'none',
                borderRadius: 8,
                padding: '2px 8px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {change && (
        <div className="text-sm font-bold mb-3" style={{ color }}>
          {sign}{change.diff.toFixed(2)} NEAR ({sign}{change.pct.toFixed(1)}%)
        </div>
      )}

      <ResponsiveContainer width="100%" height={110}>
        <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nearGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--accent-primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="near"
            stroke="var(--accent-primary)"
            strokeWidth={2}
            fill="url(#nearGrad)"
            dot={false}
            activeDot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function OverviewScreen({ selectedPeriod, onPeriodChange, balanceData }) {
  const { address } = useTelegram();
  const { theme }   = useTheme();
  const [timeRemaining,    setTimeRemaining]    = useState('');
  const [data,             setData]             = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const displayAddress = address || 'root.near';

  const nearTotal = balanceData
    ? (typeof balanceData.near === 'object'
        ? balanceData.near?.total
        : (balanceData.near || 0) + (balanceData.staking || 0))
    : 0;
  const nearPrice = balanceData?.nearPrice || 0;
  const nearUsd   = nearTotal * nearPrice;
  const hotAmount = balanceData
    ? (typeof balanceData.hot === 'object' ? balanceData.hot?.amount : balanceData.hot) || 0
    : 0;
  const claimStatus = balanceData?.hotClaim || null;

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setAnalyticsLoading(true);
        const analytics = await fetchAnalytics(displayAddress, selectedPeriod);
        setData(analytics);
      } catch (e) { setData(null); }
      finally { setAnalyticsLoading(false); }
    }
    loadAnalytics();
  }, [displayAddress, selectedPeriod]);

  useEffect(() => {
    if (!claimStatus) { setTimeRemaining(''); return; }
    if ('readyToClaim' in claimStatus) {
      if (claimStatus.readyToClaim) setTimeRemaining('Можно клеймить!');
      else {
        const h = claimStatus.hoursUntilClaim || 0;
        const m = claimStatus.minutesUntilClaim || 0;
        setTimeRemaining(h > 0 ? `${h}ч ${m}м` : `${m}м`);
      }
      return;
    }
    if (!claimStatus.nextClaimTime) { setTimeRemaining(''); return; }
    const updateTimer = () => {
      const diff = claimStatus.nextClaimTime - Date.now();
      if (diff <= 0) { setTimeRemaining('Можно клеймить!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(h > 0 ? `${h}ч ${m}м ${s}с` : `${m}м ${s}с`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [claimStatus]);

  const canClaim    = claimStatus?.readyToClaim || claimStatus?.canClaim || false;
  const maxActivity = data?.activityByDay ? Math.max(...data.activityByDay.map(d => d.txs), 1) : 1;

  const generateInsights = () => {
    if (!data) return [];
    const insights = [...(data.insights || [])];
    if (hotAmount > 0) {
      const hotFormatted = hotAmount.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
      const tokenIdx = insights.findIndex(i => i.text.includes('MOON'));
      if (tokenIdx !== -1) insights[tokenIdx] = { type: 'success', text: `HOT баланс: ${hotFormatted} токенов`, icon: '🔥' };
    }
    if (nearTotal > 0) {
      const nearUsdStr = nearUsd > 0 ? ` (~$${nearUsd.toFixed(2)})` : '';
      insights.unshift({ type: 'info', text: `NEAR баланс: ${nearTotal.toFixed(2)} NEAR${nearUsdStr}`, icon: '💰' });
    }
    return insights;
  };

  const insights = generateInsights();

  const categoryLabels = { gaming: '🕹 Gaming', defi: '💰 DeFi', transfers: '📤 Переводы', nft: '🎨 NFT' };
  const categoryAccent = { gaming: 'var(--accent-primary)', defi: 'var(--color-positive)', transfers: 'var(--accent-secondary)', nft: '#E040FB' };

  return (
    <div className="space-y-4">

      {/* Карточка портфеля */}
      {balanceData && (
        <div style={{
          width: '100%',
          borderRadius: 20,
          padding: 20,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--accent-gradient)',
          boxShadow: '0 20px 60px var(--accent-glow)',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160,
            borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
          <div style={{ color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wallet size={18} />
                <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>Портфель</span>
              </div>
              <Info size={16} style={{ opacity: 0.5 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>NEAR</div>
                <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: -1 }}>{nearTotal.toFixed(2)}</div>
                {nearUsd > 0 && <div style={{ fontSize: 12, opacity: 0.7 }}>${nearUsd.toFixed(2)}</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>HOT</div>
                <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: -1 }}>
                  {hotAmount.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>токенов</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* График */}
      <PortfolioChart address={displayAddress} />

      {/* HOT таймер */}
      {claimStatus && (
        <div style={{
          borderRadius: 16,
          padding: 16,
          background: canClaim
            ? 'linear-gradient(135deg, #FF6B00, #FF4D6A)'
            : 'var(--bg-card)',
          border: `1px solid ${canClaim ? 'rgba(255,107,0,0.4)' : 'var(--border-primary)'}`,
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>{canClaim ? '🔥' : '⏰'}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: canClaim ? '#fff' : 'var(--text-primary)' }}>
                  {canClaim ? 'HOT готов!' : 'Следующий клейм HOT'}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, color: canClaim ? '#fff' : 'var(--text-secondary)' }}>
                  {canClaim ? 'Откройте бота' : 'Осталось'}
                </div>
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
              fontWeight: 600,
              color: canClaim ? '#fff' : 'var(--color-warning)',
            }}>
              {timeRemaining || '...'}
            </div>
          </div>
        </div>
      )}

      {/* Инсайты */}
      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 14,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontSize: 20 }}>{insight.icon}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{insight.text}</div>
          </div>
        ))}
      </div>

      {/* Статистика */}
      {!analyticsLoading && data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { icon: <Activity size={14}/>, label: 'Транзакций',   value: data.totalTxs },
            { icon: <Zap size={14}/>,      label: 'Gas (NEAR)',   value: data.gasSpent.toFixed(3) },
            { icon: <Sparkles size={14}/>, label: 'Контрактов',   value: data.uniqueContracts },
            { icon: <TrendingUp size={14}/>,label: 'Топ протокол', value: data.mostActive, small: true },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-primary)',
              borderRadius: 16,
              padding: 16,
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--text-tertiary)' }}>
                {item.icon}
                <span style={{ fontSize: 11 }}>{item.label}</span>
              </div>
              <div style={{
                fontSize: item.small ? 16 : 28,
                fontWeight: item.small ? 600 : 300,
                color: 'var(--text-primary)',
                letterSpacing: -0.5,
              }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Активность + категории + топ протоколы */}
      {!analyticsLoading && data && (
        <>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16, backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Активность</span>
              <BarChart3 size={18} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 80 }}>
              {data.activityByDay.map((day, idx) => (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${maxActivity > 0 ? (day.txs / maxActivity) * 100 : 0}%`,
                      background: 'var(--accent-primary)',
                      borderRadius: '4px 4px 0 0',
                      minHeight: day.txs > 0 ? 4 : 0,
                      opacity: 0.8,
                      transition: 'height 0.3s',
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{day.day}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16, backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>По категориям</span>
              <PieChart size={18} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(data.breakdown).filter(([, val]) => val.count > 0).map(([key, val]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{categoryLabels[key]}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val.percent}%</span>
                  </div>
                  <div style={{ width: '100%', background: 'var(--border-primary)', borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${val.percent}%`, height: 6, borderRadius: 4, background: categoryAccent[key] || 'var(--accent-primary)', transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.topContracts?.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16, backdropFilter: 'blur(10px)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Топ протоколы</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.topContracts.map((contract, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 22 }}>{contract.icon}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{contract.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{contract.category}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{contract.txs} txs</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{contract.gas.toFixed(3)} N</div>
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