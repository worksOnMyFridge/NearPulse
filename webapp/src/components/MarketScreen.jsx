/**
 * MarketScreen — NEAR ecosystem market data via DexScreener public API.
 * No backend required. Auto-refreshes every 60 seconds.
 */
import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const BASE_URL = 'https://api.dexscreener.com/tokens/v1/near';

// First address = NEAR price card; the rest = ecosystem list
const TOKEN_ADDRESSES = [
  'wrap.near',
  'token.v2.ref-finance.near',
  'meta-pool.near',
  'token.burrow.near',
  'ftv2.nekotoken.near',
  'blackdragon.tkn.near',
  'token.0xshitzu.near',
];

const REFRESH_MS = 60_000;

// ─── Formatters ────────────────────────────────────────────────────────────

function fmtUsd(n) {
  if (n == null || isNaN(n)) return '—';
  const v = Number(n);
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtPrice(p) {
  if (p == null || p === '') return '—';
  const v = Number(p);
  if (isNaN(v)) return '—';
  if (v >= 1000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (v >= 1)    return `$${v.toFixed(4)}`;
  if (v >= 0.01) return `$${v.toFixed(6)}`;
  return `$${v.toExponential(2)}`;
}

function fmtChange(v) {
  const n = Number(v);
  if (isNaN(n)) return { text: '—', positive: null };
  return { text: `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`, positive: n >= 0 };
}

// Build 4-point chart data from priceChange percentages
function makePriceChart(pair) {
  if (!pair?.priceUsd) return null;
  const price = Number(pair.priceUsd);
  if (!price) return null;
  const h24 = Number(pair.priceChange?.h24 || 0);
  const h6  = Number(pair.priceChange?.h6  || 0);
  const h1  = Number(pair.priceChange?.h1  || 0);
  return [
    { t: '24ч',    v: price * (1 - h24 / 100) },
    { t: '6ч',     v: price * (1 - h6  / 100) },
    { t: '1ч',     v: price * (1 - h1  / 100) },
    { t: 'Сейчас', v: price },
  ];
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ChangeChip({ value, label }) {
  const { text, positive } = fmtChange(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 600,
        color: positive === null ? 'var(--text-secondary)'
          : positive ? 'var(--color-positive)' : 'var(--color-negative)',
      }}>
        {text}
      </span>
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function SkeletonBlock({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div className="shimmer" style={{
      width, height, borderRadius: radius,
      background: 'var(--bg-glass)', flexShrink: 0, ...style,
    }} />
  );
}

function LoadingSkeleton() {
  const card = { background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16 };
  const row  = { display: 'flex', alignItems: 'center', gap: 12 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={row}>
          <SkeletonBlock width={40} height={40} radius={20} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width="55%" height={16} />
            <SkeletonBlock width="35%" height={11} />
          </div>
        </div>
        <SkeletonBlock width="45%" height={36} />
        <SkeletonBlock width="100%" height={80} radius={8} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} height={38} style={{ flex: 1 }} />)}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[1, 2, 3].map(i => <SkeletonBlock key={i} height={34} style={{ flex: 1 }} />)}
        </div>
      </div>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{ ...card, borderRadius: 12, padding: '12px 14px', ...row }}>
          <SkeletonBlock width={36} height={36} radius={18} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width="40%" height={14} />
            <SkeletonBlock width="60%" height={11} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <SkeletonBlock width={60} height={14} />
            <SkeletonBlock width={44} height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function MarketScreen() {
  const [nearPair,     setNearPair]     = useState(null);
  const [tokens,       setTokens]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [expanded,     setExpanded]     = useState(new Set());

  const toggleExpand = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all(
        TOKEN_ADDRESSES.map(addr =>
          fetch(`${BASE_URL}/${addr}`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      );

      // Each response is an array of pairs — pick highest-volume pair per token
      const bestPairs = responses.map(data => {
        const arr = Array.isArray(data) ? data : (data.pairs || []);
        return [...arr].sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0] || null;
      });

      const [near, ...rest] = bestPairs;
      setNearPair(near || null);
      setTokens(rest.filter(Boolean));
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const id = setInterval(() => fetchData(false), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>Ошибка загрузки</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{error}</div>
      <button onClick={() => fetchData(true)} style={{
        padding: '9px 24px', borderRadius: 10, border: '1px solid var(--border-primary)',
        background: 'var(--accent-subtle)', color: 'var(--text-accent)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        Повторить
      </button>
    </div>
  );

  const chartData  = nearPair ? makePriceChart(nearPair) : null;
  const chartColor = Number(nearPair?.priceChange?.h24 || 0) >= 0
    ? 'var(--color-positive)'
    : 'var(--color-negative)';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── NEAR price card ─────────────────────────────────────────────── */}
      {nearPair ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16, backdropFilter: 'blur(20px)' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', flexShrink: 0 }}>◎</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.2 }}>NEAR Protocol</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>NEAR · {nearPair.dexId || 'DEX'}</div>
            </div>
            {lastUpdated && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>

          {/* Price */}
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 12 }}>
            {fmtPrice(nearPair.priceUsd)}
          </div>

          {/* Mini price chart */}
          {chartData && (
            <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden' }}>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="nearMiniGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#nearMiniGrad)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Price changes */}
          <div style={{ display: 'flex', gap: 4, padding: '10px 0', borderTop: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)', marginBottom: 14 }}>
            <ChangeChip value={nearPair.priceChange?.m5}  label="5м"  />
            <ChangeChip value={nearPair.priceChange?.h1}  label="1ч"  />
            <ChangeChip value={nearPair.priceChange?.h6}  label="6ч"  />
            <ChangeChip value={nearPair.priceChange?.h24} label="24ч" />
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            <StatCell label="Объём 24ч"   value={fmtUsd(nearPair.volume?.h24)} />
            <StatCell label="Ликвидность" value={fmtUsd(nearPair.liquidity?.usd)} />
            <StatCell label="FDV"         value={fmtUsd(nearPair.fdv)} />
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 16, padding: 16, color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>
          Нет данных по NEAR
        </div>
      )}

      {/* ── Ecosystem tokens ─────────────────────────────────────────────── */}
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', padding: '6px 2px 2px' }}>
        Экосистема NEAR
        <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>
          {tokens.length} токенов
        </span>
      </div>

      {tokens.length === 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          Нет данных о токенах
        </div>
      )}

      {tokens.map((pair, idx) => {
        const key    = pair.pairAddress || pair.baseToken?.address || String(idx);
        const isExp  = expanded.has(key);
        const { text: changeText, positive } = fmtChange(pair.priceChange?.h24);
        const changeColor = positive === null ? 'var(--text-secondary)'
          : positive ? 'var(--color-positive)' : 'var(--color-negative)';
        const initials = (pair.baseToken?.symbol || '?').slice(0, 2).toUpperCase();

        return (
          <div
            key={`${key}-${idx}`}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden', backdropFilter: 'blur(10px)', cursor: 'pointer' }}
            onClick={() => toggleExpand(key)}
          >
            {/* ── Main row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-accent)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pair.baseToken?.symbol || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pair.baseToken?.name || pair.dexId || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>Vol 24h</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{fmtUsd(pair.volume?.h24)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 72 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{fmtPrice(pair.priceUsd)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: changeColor }}>{changeText}</div>
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0 }}>{isExp ? '▲' : '▼'}</span>
            </div>

            {/* ── Expanded details ── */}
            {isExp && (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  <ChangeChip value={pair.priceChange?.m5}  label="5м"  />
                  <ChangeChip value={pair.priceChange?.h1}  label="1ч"  />
                  <ChangeChip value={pair.priceChange?.h6}  label="6ч"  />
                  <ChangeChip value={pair.priceChange?.h24} label="24ч" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <StatCell label="Объём 24ч"   value={fmtUsd(pair.volume?.h24)} />
                  <StatCell label="Ликвидность" value={fmtUsd(pair.liquidity?.usd)} />
                  <StatCell label="FDV"         value={fmtUsd(pair.fdv)} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
