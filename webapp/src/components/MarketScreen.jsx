/**
 * MarketScreen — NEAR ecosystem market data via DexScreener public API.
 * No backend required. Auto-refreshes every 60 seconds.
 */
import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const API_BASE        = import.meta.env.VITE_API_URL || 'https://nearpulse.onrender.com';
const BASE_URL        = 'https://api.dexscreener.com/tokens/v1/near';
const SEARCH_URL      = `${API_BASE}/api/market/near`;
const PROFILES_URL    = `${API_BASE}/api/market/new-tokens`;
const REFRESH_MS      = 60_000;
const MIN_VOL         = 1000;

// First address → NEAR price card; rest → ecosystem list
const TOKEN_ADDRESSES = [
  'wrap.near',
  'token.v2.ref-finance.near',
  'meta-pool.near',
  'token.burrow.near',
  'ftv2.nekotoken.near',
  'blackdragon.tkn.near',
  'token.0xshitzu.near',
];

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

function shortAddr(addr) {
  if (!addr || addr.length <= 16) return addr || '—';
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// Build 4-point sparkline from priceChange percentages
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

// Deduplicate an array of pairs by baseToken.symbol, keeping highest volume
function dedupBySymbol(pairs) {
  const map = new Map();
  for (const p of pairs) {
    const sym = p.baseToken?.symbol;
    if (!sym) continue;
    const existing = map.get(sym);
    if (!existing || (p.volume?.h24 || 0) > (existing.volume?.h24 || 0)) {
      map.set(sym, p);
    }
  }
  return [...map.values()];
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

function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div className="shimmer" style={{
      width, height, borderRadius: radius,
      background: 'var(--bg-glass)', flexShrink: 0, ...style,
    }} />
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', padding: '6px 2px 2px' }}>
      {children}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-primary)',
      borderRadius: 16,
      backdropFilter: 'blur(20px)',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  const row = { display: 'flex', alignItems: 'center', gap: 12 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* NEAR card skeleton */}
      <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={row}>
          <Skeleton width={40} height={40} radius={20} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="55%" height={16} />
            <Skeleton width="35%" height={11} />
          </div>
        </div>
        <Skeleton width="45%" height={36} />
        <Skeleton width="100%" height={80} radius={8} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} height={38} style={{ flex: 1 }} />)}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[1,2,3].map(i => <Skeleton key={i} height={34} style={{ flex: 1 }} />)}
        </div>
      </Card>
      {/* Token list skeletons */}
      {[1,2,3,4,5,6].map(i => (
        <div key={i} style={{ ...{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '12px 14px' }, ...row }}>
          <Skeleton width={36} height={36} radius={18} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="60%" height={11} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <Skeleton width={60} height={14} />
            <Skeleton width={44} height={12} />
          </div>
        </div>
      ))}
      {/* Gainers/losers skeleton */}
      <Skeleton width="40%" height={18} />
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(i => <Skeleton key={i} height={36} radius={8} />)}
        </div>
      </Card>
      {/* Top pairs skeleton */}
      <Skeleton width="40%" height={18} />
      <Card>
        {[1,2,3,4].map((i, idx) => (
          <div key={i} style={{ padding: '12px 16px', borderTop: idx > 0 ? '1px solid var(--border-primary)' : 'none', ...row }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="35%" height={11} />
            </div>
            <Skeleton width={60} height={14} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function MarketScreen() {
  const [nearPair,    setNearPair]    = useState(null);
  const [tokens,      setTokens]      = useState([]);
  const [marketData,  setMarketData]  = useState(null);  // { gainers, losers, topPairs }
  const [newListings, setNewListings] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expanded,    setExpanded]    = useState(new Set());

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
      // Fetch all sources simultaneously
      const [tokenResponses, searchRes, profilesRes] = await Promise.all([
        Promise.all(
          TOKEN_ADDRESSES.map(addr =>
            fetch(`${BASE_URL}/${addr}`)
              .then(r => r.ok ? r.json() : [])
              .catch(() => [])
          )
        ),
        fetch(SEARCH_URL).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        fetch(PROFILES_URL).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      // ── Known ecosystem tokens ────────────────────────────────────────────
      const bestPairs = tokenResponses.map(data => {
        const arr = Array.isArray(data) ? data : (data.pairs || []);
        return [...arr].sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0] || null;
      });
      const [near, ...rest] = bestPairs;
      setNearPair(near || null);
      setTokens(rest.filter(Boolean));

      // ── Market data from search (proxied through our API) ────────────────
      const allPairs = (searchRes.pairs || []).filter(
        p => p.priceUsd && (p.volume?.h24 || 0) > MIN_VOL
      );
      const deduped = dedupBySymbol(allPairs);

      const sorted  = [...deduped].sort((a, b) =>
        (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0)
      );
      const gainers = sorted.filter(p => (p.priceChange?.h24 || 0) > 0).slice(0, 5);
      const losers  = [...sorted].reverse().filter(p => (p.priceChange?.h24 || 0) < 0).slice(0, 5);
      const topPairs = [...deduped]
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, 8);

      setMarketData(gainers.length || losers.length || topPairs.length
        ? { gainers, losers, topPairs }
        : null
      );

      // ── New listings (proxied through our API, already filtered to near) ──
      const nearNew = (profilesRes.tokens || []).slice(0, 5);
      setNewListings(nearNew);

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

  if (loading) return <LoadingSkeleton />;

  if (error) return (
    <Card style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>Ошибка загрузки</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{error}</div>
      <button onClick={() => fetchData(true)} style={{
        padding: '9px 24px', borderRadius: 10,
        border: '1px solid var(--border-primary)',
        background: 'var(--accent-subtle)', color: 'var(--text-accent)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        Повторить
      </button>
    </Card>
  );

  const chartData  = nearPair ? makePriceChart(nearPair) : null;
  const chartColor = Number(nearPair?.priceChange?.h24 || 0) >= 0
    ? 'var(--color-positive)'
    : 'var(--color-negative)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── NEAR price card ─────────────────────────────────────────────── */}
      {nearPair ? (
        <Card style={{ padding: 16 }}>
          {/* Header */}
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
                  <Area type="monotone" dataKey="v" stroke={chartColor} strokeWidth={2}
                    fill="url(#nearMiniGrad)" dot={false} isAnimationActive={false} />
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
        </Card>
      ) : (
        <Card style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>
          Нет данных по NEAR
        </Card>
      )}

      {/* ── Ecosystem token list ─────────────────────────────────────────── */}
      <SectionTitle>
        Экосистема NEAR
        <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6 }}>
          {tokens.length} токенов
        </span>
      </SectionTitle>

      {tokens.map((pair, idx) => {
        const key    = pair.pairAddress || pair.baseToken?.address || String(idx);
        const isExp  = expanded.has(key);
        const { text: changeText, positive } = fmtChange(pair.priceChange?.h24);
        const changeColor = positive === null ? 'var(--text-secondary)'
          : positive ? 'var(--color-positive)' : 'var(--color-negative)';
        const initials = (pair.baseToken?.symbol || '?').slice(0, 2).toUpperCase();

        return (
          <div key={`${key}-${idx}`}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden', backdropFilter: 'blur(10px)', cursor: 'pointer' }}
            onClick={() => toggleExpand(key)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-subtle)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-accent)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pair.baseToken?.symbol || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pair.baseToken?.name || pair.dexId || '—'}</div>
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

      {/* ── SECTION 1: Top Gainers / Losers ─────────────────────────────── */}
      {marketData && (marketData.gainers.length > 0 || marketData.losers.length > 0) && (() => {
        const GainerRow = ({ pair }) => {
          const { text, positive } = fmtChange(pair.priceChange?.h24);
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pair.baseToken?.symbol || '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{fmtPrice(pair.priceUsd)}</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: positive ? 'var(--color-positive)' : 'var(--color-negative)', flexShrink: 0, marginLeft: 8 }}>
                {text}
              </div>
            </div>
          );
        };

        return (
          <>
            <SectionTitle>Топ роста и падения за 24ч</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Gainers */}
              <Card style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-positive)', marginBottom: 8 }}>🚀 Растут</div>
                <div style={{ display: 'flex', flexDirection: 'column', divideY: '1px solid var(--border-primary)' }}>
                  {marketData.gainers.map((p, i) => (
                    <div key={i} style={{ borderTop: i > 0 ? '1px solid var(--border-primary)' : 'none' }}>
                      <GainerRow pair={p} />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Losers */}
              <Card style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-negative)', marginBottom: 8 }}>📉 Падают</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {marketData.losers.map((p, i) => (
                    <div key={i} style={{ borderTop: i > 0 ? '1px solid var(--border-primary)' : 'none' }}>
                      <GainerRow pair={p} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        );
      })()}

      {/* ── SECTION 2: Top Pairs by Volume ──────────────────────────────── */}
      {marketData?.topPairs?.length > 0 && (() => {
        return (
          <>
            <SectionTitle>Топ пары по объёму</SectionTitle>
            <Card>
              {marketData.topPairs.map((pair, idx) => {
                const quoteSymbol = pair.quoteToken?.symbol || 'USDT';
                const baseSymbol  = pair.baseToken?.symbol  || '—';
                const { text: chgText, positive } = fmtChange(pair.priceChange?.h24);
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    borderTop: idx > 0 ? '1px solid var(--border-primary)' : 'none',
                  }}>
                    {/* Pair label */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {baseSymbol} → {quoteSymbol}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                        Ликв. {fmtUsd(pair.liquidity?.usd)}
                      </div>
                    </div>
                    {/* Volume */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtUsd(pair.volume?.h24)}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: positive === null ? 'var(--text-secondary)' : positive ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                        {chgText}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        );
      })()}

      {/* ── SECTION 3: New Listings ──────────────────────────────────────── */}
      {newListings.length > 0 && (() => {
        return (
          <>
            <SectionTitle>🆕 Новые листинги</SectionTitle>
            <Card>
              {newListings.map((profile, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  borderTop: idx > 0 ? '1px solid var(--border-primary)' : 'none',
                }}>
                  {/* Icon */}
                  {profile.icon ? (
                    <img
                      src={profile.icon}
                      alt={profile.tokenAddress}
                      style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent-subtle)', border: '1px solid var(--border-primary)',
                    display: profile.icon ? 'none' : 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    🪙
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile.name || shortAddr(profile.tokenAddress)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                      {shortAddr(profile.tokenAddress)}
                    </div>
                  </div>
                  {profile.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 80, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile.description}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </>
        );
      })()}

    </div>
  );
}
