/**
 * GalleryScreen v2 — /api/nft-tokens/<account> через NearBlocks индекс.
 * Никаких RPC вызовов. Поддерживает 300+ NFT через пагинацию.
 */
import { useState, useEffect, useRef } from 'react';
import { useTelegram } from '../hooks/useTelegram';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nearpulse.onrender.com';
const PER_PAGE = 24;

function NftCard({ token }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Load image only when the card enters the viewport (+ 150px margin)
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '150px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1', background: '#f5f3ff' }}>
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 animate-pulse" style={{ background: '#ede9fe' }} />
      )}
      {inView && token.media && !imgError ? (
        <img
          src={token.media}
          alt={token.title}
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      ) : imgError || !token.media ? (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-3xl">🖼️</span>
        </div>
      ) : null}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}>
        <div className="text-white text-xs font-medium truncate">{token.title}</div>
        {token.contractName && (
          <div className="text-white/60 text-[10px] truncate">{token.contractName}</div>
        )}
      </div>
    </div>
  );
}

export default function GalleryScreenStable() {
  const { address } = useTelegram();
  const displayAddress = address || 'root.near';
  const [tokens, setTokens] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('grid');
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  useEffect(() => { loadTokens(1, true); }, [displayAddress]);

  async function loadTokens(p, reset = false) {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const r = await fetch(`${API_BASE}/api/nft-tokens/${displayAddress}?page=${p}&per_page=${PER_PAGE}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (reset || p === 1) setTokens(data.tokens || []);
      else setTokens(prev => [...prev, ...(data.tokens || [])]);
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setPage(p);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setLoadingMore(false); }
  }

  async function loadCollections() {
    if (collections.length > 0) return;
    setCollectionsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/nfts/${displayAddress}?per_page=50`);
      const data = await r.json();
      setCollections(data.nfts || []);
    } catch (e) { console.error(e); }
    finally { setCollectionsLoading(false); }
  }

  function switchView(v) {
    setView(v);
    if (v === 'collections') loadCollections();
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: '#a78bfa', borderTopColor: 'transparent' }} />
      <div className="text-sm text-gray-500">Загружаем NFT...</div>
    </div>
  );

  if (error) return (
    <div className="rounded-xl p-6 text-center bg-white border border-red-100">
      <div className="text-3xl mb-2">⚠️</div>
      <div className="font-medium text-gray-900 mb-1">Ошибка загрузки</div>
      <div className="text-sm text-gray-500 mb-3">{error}</div>
      <button onClick={() => { setError(null); loadTokens(1, true); }}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: '#f5f3ff', color: '#6366f1' }}>
        Попробовать снова
      </button>
    </div>
  );

  if (tokens.length === 0) return (
    <div className="rounded-xl p-10 text-center bg-white border border-gray-100">
      <div className="text-5xl mb-3">🖼️</div>
      <div className="font-semibold text-gray-900">NFT не найдены</div>
      <div className="text-sm text-gray-500 mt-1">NFT не найдены для этого кошелька.</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">NFT Галерея</div>
          <div className="text-xs text-gray-500">{total.toLocaleString()} токенов</div>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          {[{ key: 'grid', label: '⊞' }, { key: 'collections', label: '☰' }].map(({ key, label }) => (
            <button key={key} onClick={() => switchView(key)}
              className="px-3 py-1.5 text-sm transition-all"
              style={{ background: view === key ? '#6366f1' : '#fff', color: view === key ? '#fff' : '#6b7280' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {view === 'grid' && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {tokens.map((token, idx) => (
              <NftCard key={`${token.contract}-${token.tokenId}-${idx}`} token={token} />
            ))}
          </div>
          {hasMore && (
            <button onClick={() => loadTokens(page + 1)} disabled={loadingMore}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#f5f3ff', color: '#6366f1' }}>
              {loadingMore
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: '#a78bfa', borderTopColor: 'transparent' }} />
                    Загрузка...
                  </span>
                : `Загрузить ещё · ${tokens.length} из ${total}`}
            </button>
          )}
        </>
      )}

      {/* Collections */}
      {view === 'collections' && (
        collectionsLoading
          ? <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#a78bfa', borderTopColor: 'transparent' }} />
            </div>
          : <div className="space-y-2">
              {collections.map((col, idx) => (
                <div key={`${col.contract}-${idx}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl"
                    style={{ background: '#f5f3ff' }}>🖼️</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {col.contract.split('.')[0].replace(/-/g, ' ')}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{col.contract}</div>
                  </div>
                  <div className="flex-shrink-0 px-2 py-0.5 rounded-lg text-sm font-bold"
                    style={{ background: '#f5f3ff', color: '#6366f1' }}>
                    {col.count || '?'}
                  </div>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}
