import { useState, useEffect, useRef, useCallback } from 'react';
import { Image, Check, X, Trash2, RotateCcw, AlertCircle, Folder, Flame, Loader } from 'lucide-react';
import { fetchNFTCount, fetchNFTsPaginated } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';
import LoadingSpinner from './LoadingSpinner';

export default function GalleryScreen() {
  const { address } = useTelegram();
  const [nftCount, setNftCount] = useState(null);
  const [walletNFTs, setWalletNFTs] = useState([]);
  const [hotStakedNFTs, setHotStakedNFTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNFTs, setSelectedNFTs] = useState(new Set());
  const [spamNFTs, setSpamNFTs] = useState(new Set());
  
  const displayAddress = address || 'leninjiv23.tg';
  const observer = useRef();

  // Быстрая загрузка счётчика NFT
  useEffect(() => {
    async function loadCount() {
      try {
        const count = await fetchNFTCount(displayAddress);
        
        if (count.error) {
          console.warn('[Gallery] NFT count failed:', count.error);
          setNftCount({ total: 0, wallet: 0, hotStaked: 0 });
        } else {
          setNftCount(count);
        }
      } catch (err) {
        console.error('Error loading NFT count:', err);
        setNftCount({ total: 0, wallet: 0, hotStaked: 0 });
      }
    }

    loadCount();
  }, [displayAddress]);

  // Загрузка первой страницы NFT
  useEffect(() => {
    async function loadFirstPage() {
      try {
        setLoading(true);
        setError(null);
        
        const nftData = await fetchNFTsPaginated(displayAddress, 1, 50);
        
        if (nftData.error) {
          setError(nftData.error === 'NFT_TIMEOUT' 
            ? 'NFT загружаются дольше обычного. Попробуйте позже.' 
            : 'Ошибка загрузки NFT');
          setWalletNFTs([]);
          setHotStakedNFTs([]);
          setHasMore(false);
        } else {
          setWalletNFTs(nftData.wallet || []);
          setHotStakedNFTs(nftData.hotStaked || []);
          setHasMore(nftData.hasMore);
        }
        
        // Загружаем сохранённые спам NFT из localStorage
        const savedSpam = localStorage.getItem(`spam_nfts_${displayAddress}`);
        if (savedSpam) {
          setSpamNFTs(new Set(JSON.parse(savedSpam)));
        }
      } catch (err) {
        console.error('Error loading NFTs:', err);
        setError('Ошибка загрузки NFT');
      } finally {
        setLoading(false);
      }
    }

    loadFirstPage();
  }, [displayAddress]);

  // Загрузка следующей страницы NFT
  const loadMoreNFTs = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      
      const nftData = await fetchNFTsPaginated(displayAddress, nextPage, 50);
      
      if (nftData.error) {
        console.warn('[Gallery] Load more failed:', nftData.error);
        setHasMore(false);
      } else {
        setWalletNFTs(prev => [...prev, ...(nftData.wallet || [])]);
        setHasMore(nftData.hasMore);
        setCurrentPage(nextPage);
        
        console.log(`[Gallery] Загружена страница ${nextPage}: +${nftData.wallet?.length || 0} NFT`);
      }
    } catch (err) {
      console.error('Error loading more NFTs:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [displayAddress, currentPage, hasMore, loadingMore]);

  // Intersection Observer для infinite scroll
  const lastNFTRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreNFTs();
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, loadMoreNFTs]);

  // Группировка NFT по коллекциям
  const groupByCollection = (nftList) => {
    const groups = {};
    
    nftList.forEach(nft => {
      // Используем collection_id если есть, иначе contract
      const collection = nft.collection_id || nft.collection || nft.contract;
      if (!groups[collection]) {
        groups[collection] = {
          id: collection,
          nfts: [],
          count: 0,
        };
      }
      groups[collection].nfts.push(nft);
      groups[collection].count++;
    });
    
    return groups;
  };

  // Получаем отфильтрованные NFT
  const getFilteredNFTs = () => {
    // Фильтруем по спаму
    const filteredWallet = walletNFTs.filter(nft => {
      const nftId = `${nft.contract}_${nft.token_id}`;
      const isSpam = spamNFTs.has(nftId);
      
      if (selectedFolder === 'spam') return isSpam;
      if (selectedFolder === 'hot') return false;
      return !isSpam;
    });
    
    return {
      wallet: filteredWallet,
      hotStaked: selectedFolder === 'hot' ? hotStakedNFTs : (selectedFolder === 'spam' ? [] : hotStakedNFTs)
    };
  };

  const filteredNFTs = getFilteredNFTs();
  const allDisplayNFTs = [...filteredNFTs.wallet, ...filteredNFTs.hotStaked];
  const groupedCollections = groupByCollection(allDisplayNFTs);
  
  // Сортируем коллекции по количеству NFT (самые большие сверху)
  const sortedCollections = Object.entries(groupedCollections)
    .sort(([, a], [, b]) => b.count - a.count);

  // Подсчёт NFT в папках (используем счётчик из API если доступен)
  const folderCounts = {
    all: (nftCount?.total || walletNFTs.length) - spamNFTs.size,
    hot: hotStakedNFTs.length,
    spam: spamNFTs.size,
  };

  // Переключение выбора NFT
  const toggleSelectNFT = (nft) => {
    const nftId = `${nft.contract}_${nft.token_id}`;
    const newSelected = new Set(selectedNFTs);
    
    if (newSelected.has(nftId)) {
      newSelected.delete(nftId);
    } else {
      newSelected.add(nftId);
    }
    
    setSelectedNFTs(newSelected);
  };

  // Выбрать все NFT
  const selectAll = () => {
    const allIds = allDisplayNFTs.map(nft => `${nft.contract}_${nft.token_id}`);
    setSelectedNFTs(new Set(allIds));
  };

  // Снять выбор
  const deselectAll = () => {
    setSelectedNFTs(new Set());
  };

  // Переместить в спам
  const moveToSpam = () => {
    const newSpam = new Set([...spamNFTs, ...selectedNFTs]);
    setSpamNFTs(newSpam);
    localStorage.setItem(`spam_nfts_${displayAddress}`, JSON.stringify([...newSpam]));
    setSelectedNFTs(new Set());
    setSelectMode(false);
  };

  // Восстановить из спама
  const restoreFromSpam = () => {
    const newSpam = new Set(spamNFTs);
    selectedNFTs.forEach(id => newSpam.delete(id));
    setSpamNFTs(newSpam);
    localStorage.setItem(`spam_nfts_${displayAddress}`, JSON.stringify([...newSpam]));
    setSelectedNFTs(new Set());
    setSelectMode(false);
  };

  // Удалить (скрыть навсегда)
  const deleteNFTs = () => {
    // В будущем можно добавить API call для удаления
    if (selectedFolder === 'spam') {
      restoreFromSpam();
    } else {
      moveToSpam();
    }
  };

  // Загрузка
  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSpinner />
      </div>
    );
  }

  // Ошибка
  if (error) {
    return (
      <div className="space-y-4">
        <div className="glass-card rounded-xl p-4 text-center border-red-500/30">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-primary font-medium mb-1">Ошибка загрузки NFT</div>
          <div className="text-secondary text-sm">{error}</div>
        </div>
      </div>
    );
  }

  // Нет NFT
  if (!loading && walletNFTs.length === 0 && hotStakedNFTs.length === 0 && spamNFTs.size === 0) {
    return (
      <div className="space-y-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-4xl mb-2">🎨</div>
          <div className="text-primary font-medium mb-1">Нет NFT</div>
          <div className="text-secondary text-sm">У вас пока нет NFT в коллекции</div>
        </div>
      </div>
    );
  }
  
  // Показываем ошибку но не блокируем UI
  const showError = error && walletNFTs.length === 0;

  return (
    <div className="space-y-4 pb-20">
      {/* Ошибка (не блокирует UI) */}
      {showError && (
        <div className="glass-card rounded-xl p-3 border border-orange-500/30">
          <div className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="w-5 h-5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        </div>
      )}

      {/* Заголовок и режим выбора */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-primary">Галерея NFT</h2>
          {nftCount && nftCount.total > 0 && (
            <div className="text-xs text-secondary mt-1">
              Всего: {nftCount.total.toLocaleString('ru-RU')} NFT
            </div>
          )}
        </div>
        
        {!selectMode ? (
          <button
            onClick={() => setSelectMode(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-all"
          >
            Выбрать
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-2 glass-card text-primary rounded-lg text-sm font-medium hover:scale-105 transition-all"
            >
              Все
            </button>
            <button
              onClick={() => {
                deselectAll();
                setSelectMode(false);
              }}
              className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all"
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {/* Папки */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => {
            setSelectedFolder('all');
            deselectAll();
            setSelectMode(false);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            selectedFolder === 'all'
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'glass-card text-primary hover:scale-105'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>Все ({folderCounts.all})</span>
        </button>

        <button
          onClick={() => {
            setSelectedFolder('hot');
            deselectAll();
            setSelectMode(false);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            selectedFolder === 'hot'
              ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
              : 'glass-card text-primary hover:scale-105'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>HOT Craft ({folderCounts.hot})</span>
        </button>

        <button
          onClick={() => {
            setSelectedFolder('spam');
            deselectAll();
            setSelectMode(false);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            selectedFolder === 'spam'
              ? 'bg-gray-500 text-white shadow-lg shadow-gray-500/30'
              : 'glass-card text-primary hover:scale-105'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Спам ({folderCounts.spam})</span>
        </button>
      </div>

      {/* NFT по коллекциям */}
      {sortedCollections.length === 0 ? (
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-4xl mb-2">📭</div>
          <div className="text-primary font-medium mb-1">Пусто</div>
          <div className="text-secondary text-sm">
            {selectedFolder === 'spam' 
              ? 'Нет NFT в спаме' 
              : selectedFolder === 'hot'
              ? 'Нет застейканных NFT в HOT'
              : 'Нет NFT в этой категории'}
          </div>
        </div>
      ) : (
        sortedCollections.map(([collectionId, collectionData]) => (
          <div key={collectionId} className="space-y-3">
            {/* Название коллекции */}
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-secondary" />
              <h3 className="font-semibold text-primary text-sm">
                {collectionId.length > 30 
                  ? collectionId.substring(0, 20) + '...' + collectionId.slice(-8)
                  : collectionId}
              </h3>
              <span className="text-xs text-secondary">({collectionData.count})</span>
            </div>

            {/* Сетка NFT */}
            <div className="grid grid-cols-2 gap-3">
              {collectionData.nfts.map((nft, idx) => {
                const nftId = `${nft.contract}_${nft.token_id}`;
                const isSelected = selectedNFTs.has(nftId);
                const isHotStaked = hotStakedNFTs.some(
                  h => h.contract === nft.contract && h.token_id === nft.token_id
                );
                
                // Последний элемент для Intersection Observer
                const isLastInCollection = idx === collectionData.nfts.length - 1;
                const isLastCollection = sortedCollections[sortedCollections.length - 1][0] === collectionId;
                const shouldObserve = isLastInCollection && isLastCollection;

                return (
                  <div
                    key={idx}
                    ref={shouldObserve ? lastNFTRef : null}
                    onClick={() => selectMode && toggleSelectNFT(nft)}
                    className={`glass-card rounded-lg p-3 hover:bg-glass-hover transition-all cursor-pointer relative ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    } ${selectMode ? 'hover:scale-105' : ''}`}
                  >
                    {/* Чекбокс в режиме выбора */}
                    {selectMode && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-blue-500 shadow-lg shadow-blue-500/50' 
                            : 'glass-card border border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    )}

                    {/* HOT бейдж */}
                    {isHotStaked && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="px-2 py-1 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center gap-1">
                          <Flame className="w-3 h-3 text-white" />
                          <span className="text-xs text-white font-medium">HOT</span>
                        </div>
                      </div>
                    )}

                    {/* Изображение NFT */}
                    {nft.media ? (
                      <div className="w-full h-32 bg-glass rounded-lg mb-2 overflow-hidden">
                        <img 
                          src={nft.media} 
                          alt={nft.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full hidden items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                          <Image className="w-8 h-8 text-purple-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg mb-2 flex items-center justify-center">
                        <Image className="w-8 h-8 text-purple-400" />
                      </div>
                    )}

                    {/* Информация */}
                    <div className="text-sm font-medium text-primary truncate">
                      {nft.title || nft.token_id}
                    </div>
                    <div className="text-xs text-secondary truncate">
                      ID: {nft.token_id.substring(0, 10)}...
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Индикатор загрузки следующей страницы */}
      {loadingMore && (
        <div className="glass-card rounded-xl p-4 flex items-center justify-center gap-2">
          <Loader className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-sm text-secondary">Загружаем ещё NFT...</span>
        </div>
      )}

      {/* Конец списка */}
      {!loading && !loadingMore && !hasMore && allDisplayNFTs.length > 0 && (
        <div className="text-center text-xs text-secondary py-4">
          Все NFT загружены ({allDisplayNFTs.length})
        </div>
      )}

      {/* Bottom Toolbar - массовые действия */}
      {selectMode && selectedNFTs.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto p-4 glass-card border-t border-glass z-50 animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-primary">
              Выбрано: {selectedNFTs.size}
            </div>
            <button
              onClick={deselectAll}
              className="text-xs text-secondary hover:text-primary"
            >
              Снять выбор
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {selectedFolder === 'spam' ? (
              <>
                <button
                  onClick={restoreFromSpam}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Восстановить</span>
                </button>
                <button
                  onClick={deleteNFTs}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Удалить</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={moveToSpam}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>В спам</span>
                </button>
                <button
                  onClick={deleteNFTs}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Удалить</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
