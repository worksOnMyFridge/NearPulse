/**
 * GalleryScreen — NFT галерея с ленивой загрузкой.
 * 
 * Архитектура (НЕ делаем 300 RPC запросов):
 * 1. Один запрос → список контрактов (только имя + кол-во)
 * 2. Intersection Observer → когда карточка появляется в viewport, грузим мета
 * 3. "Загрузить ещё" → следующая страница контрактов
 * 4. Клик по контракту → пагинированные токены (12 за раз)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelegram } from '../hooks/useTelegram';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nearpulse.onrender.com';

// ─── Хук: загрузка метаданных когда элемент появляется в viewport ──────────
function useIntersectionMeta(contractId, accountId, enabled = true) {
  const ref = useRef(null);
  const [meta, setMeta] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loaded) {
          setLoaded(true);
          fetch(`${API_BASE}/api/nft-meta/${accountId}/${contractId}`)
            .then((r) => r.json())
            .then((data) => setMeta(data))
            .catch(() => setMeta({ name: contractId.split('.')[0], icon: null }));
        }
      },
      { rootMargin: '100px' } // Грузим чуть заранее
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [contractId, accountId, enabled, loaded]);

  return { ref, meta };
}

// ─── Карточка коллекции ─────────────────────────────────────────────────────
function CollectionCard({ contract, accountId, onExpand }) {
  const { ref, meta } = useIntersectionMeta(contract.contract, accountId);
  const displayName = meta?.name || contract.contract.split('.')[0];
  const icon = meta?.icon;

  return (
    <div
      ref={ref}
      onClick={() => onExpand(contract)}
      className="flex items-center gap-3 p-3 rounded-xl active:scale-[0.98] transition-all cursor-pointer"
      style={{ background: '#fff', border: '1px solid #f0f0f0' }}
    >
      {/* Иконка коллекции */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ background: '#f5f3ff' }}
      >
        {icon ? (
          <img src={icon} alt={displayName} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <span className="text-xl">🖼️</span>
        )}
      </div>

      {/* Инфо */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-gray-900 truncate">{displayName}</div>
        <div className="text-xs text-gray-500 truncate">{contract.contract}</div>
      </div>

      {/* Кол-во */}
      <div className="flex-shrink-0 text-right">
        <div
          className="text-sm font-bold px-2 py-0.5 rounded-lg"
          style={{ background: '#f5f3ff', color: '#6366f1' }}
        >
          {contract.count > 0 ? contract.count : '?'}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">NFT</div>
      </div>

      <div className="text-gray-400 text-sm flex-shrink-0">›</div>
    </div>
  );
}

// ─── Панель токенов конкретной коллекции ───────────────────────────────────
function TokensPanel({ contract, accountId, onClose }) {
  const [tokens, setTokens] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);

  const PER_PAGE = 12;

  // Загрузить метаданные контракта
  useEffect(() => {
    fetch(`${API_BASE}/api/nft-meta/${accountId}/${contract.contract}`)
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
  }, [contract.contract, accountId]);

  // Загрузить первую страницу токенов
  useEffect(() => {
    loadPage(1);
  }, []);

  async function loadPage(p) {
    setLoading(true);
    try {
      const r = await fetch(
        `${API_BASE}/api/nft-tokens/${accountId}/${contract.contract}?page=${p}&per_page=${PER_PAGE}`
      );
      const data = await r.json();
      if (p === 1) {
        setTokens(data.tokens || []);
      } else {
        setTokens((prev) => [...prev, ...(data.tokens || [])]);
      }
      setHasMore((data.tokens || []).length === PER_PAGE);
      setPage(p);
    } catch (e) {
      console.error('NFT tokens load error:', e);
    } finally {
      setLoading(false);
    }
  }

  const displayName = meta?.name || contract.contract.split('.')[0];

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: '#fff' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="text-gray-500 text-lg px-1">←</button>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{displayName}</div>
          <div className="text-xs text-gray-500">{contract.count || '?'} NFT</div>
        </div>
      </div>

      {/* Tokens grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {tokens.length === 0 && !loading ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-2">🖼️</div>
            <div className="text-sm">Не удалось загрузить токены</div>
            <div className="text-xs mt-1">Контракт может не поддерживать nft_tokens_for_owner</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {tokens.map((token, idx) => (
              <div
                key={`${token.tokenId}-${idx}`}
                className="rounded-xl overflow-hidden"
                style={{ background: '#f5f5f5', aspectRatio: '1' }}
              >
                {token.media ? (
                  <img
                    src={
                      token.media.startsWith('http') || token.media.startsWith('data:')
                        ? token.media
                        : `https://ipfs.near.social/ipfs/${token.media}`
                    }
                    alt={token.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.target.parentNode.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px">🖼️</div>`;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    <div className="text-2xl">🖼️</div>
                    <div className="text-xs text-gray-500 text-center mt-1 truncate w-full">
                      {token.title}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Загрузить ещё */}
        {hasMore && !loading && tokens.length > 0 && (
          <button
            onClick={() => loadPage(page + 1)}
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
            style={{ background: '#f5f3ff', color: '#6366f1' }}
          >
            Загрузить ещё ({PER_PAGE})
          </button>
        )}

        {loading && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Основной экран галереи ─────────────────────────────────────────────────
export default function GalleryScreenStable() {
  const { address } = useTelegram();
  const displayAddress = address || 'leninjiv23.tg';

  const [contracts, setContracts] = useState([]);
  const [totalNfts, setTotalNfts] = useState(0);
  const [totalContracts, setTotalContracts] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null); // Открытая коллекция

  const PER_PAGE = 20;

  useEffect(() => {
    loadContracts(1);
  }, [displayAddress]);

  async function loadContracts(p) {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const r = await fetch(
        `${API_BASE}/api/nfts/${displayAddress}?page=${p}&per_page=${PER_PAGE}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      if (p === 1) {
        setContracts(data.nfts || []);
      } else {
        setContracts((prev) => [...prev, ...(data.nfts || [])]);
      }

      setTotalNfts(data.totalNfts || 0);
      setTotalContracts(data.totalContracts || 0);
      setHasMore(data.hasMore || false);
      setPage(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Открыта конкретная коллекция
  if (expanded) {
    return (
      <TokensPanel
        contract={expanded}
        accountId={displayAddress}
        onClose={() => setExpanded(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm text-gray-500">Загружаем NFT коллекции...</div>
        <div className="text-xs text-gray-400">Один запрос, без задержек</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: '#fff', border: '1px solid #fee2e2' }}>
        <div className="text-3xl mb-2">⚠️</div>
        <div className="font-medium text-gray-900 mb-1">Ошибка загрузки</div>
        <div className="text-sm text-gray-500">{error}</div>
        <button onClick={() => loadContracts(1)} className="mt-3 px-4 py-2 rounded-lg text-sm" style={{ background: '#f5f3ff', color: '#6366f1' }}>
          Попробовать снова
        </button>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center bg-white border border-gray-100">
        <div className="text-5xl mb-3">🖼️</div>
        <div className="font-semibold text-gray-900">NFT не найдены</div>
        <div className="text-sm text-gray-500 mt-1">На этом кошельке нет NFT</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">NFT Коллекции</div>
          <div className="text-xs text-gray-500">
            {totalContracts} коллекций · {totalNfts.toLocaleString()} NFT
          </div>
        </div>
        {/* Бейдж с подсказкой */}
        <div className="px-2 py-1 rounded-lg text-xs" style={{ background: '#f0fdf4', color: '#166534' }}>
          ✓ Быстрая загрузка
        </div>
      </div>

      {/* Список коллекций */}
      <div className="space-y-2">
        {contracts.map((contract, idx) => (
          <CollectionCard
            key={`${contract.contract}-${idx}`}
            contract={contract}
            accountId={displayAddress}
            onExpand={setExpanded}
          />
        ))}
      </div>

      {/* Загрузить ещё коллекции */}
      {hasMore && (
        <button
          onClick={() => loadContracts(page + 1)}
          disabled={loadingMore}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ background: '#f5f3ff', color: '#6366f1' }}
        >
          {loadingMore ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              Загрузка...
            </span>
          ) : (
            `Показать ещё коллекции (${totalContracts - contracts.length} осталось)`
          )}
        </button>
      )}
    </div>
  );
}
