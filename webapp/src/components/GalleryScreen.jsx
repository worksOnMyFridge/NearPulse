import { useState, useEffect } from 'react';
import { Image, Check, X, Trash2, RotateCcw, AlertCircle, Folder, Flame } from 'lucide-react';
import { fetchNFTs } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';
import LoadingSpinner from './LoadingSpinner';

export default function GalleryScreen() {
  const { address } = useTelegram();
  const [nfts, setNfts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNFTs, setSelectedNFTs] = useState(new Set());
  const [spamNFTs, setSpamNFTs] = useState(new Set()); // Локальное состояние спама
  
  const displayAddress = address || 'leninjiv23.tg';

  // Загружаем NFT
  useEffect(() => {
    async function loadNFTs() {
      try {
        setLoading(true);
        setError(null);
        const nftData = await fetchNFTs(displayAddress);
        setNfts(nftData);
        
        // Загружаем сохранённые спам NFT из localStorage
        const savedSpam = localStorage.getItem(`spam_nfts_${displayAddress}`);
        if (savedSpam) {
          setSpamNFTs(new Set(JSON.parse(savedSpam)));
        }
      } catch (err) {
        console.error('Error loading NFTs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadNFTs();
  }, [displayAddress]);

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
    if (!nfts) return { wallet: [], hotStaked: [] };
    
    const walletNFTs = nfts.wallet || [];
    const hotStakedNFTs = nfts.hotStaked || [];
    
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

  // Подсчёт NFT в папках
  const folderCounts = {
    all: (nfts?.wallet?.length || 0) + (nfts?.hotStaked?.length || 0) - spamNFTs.size,
    hot: nfts?.hotStaked?.length || 0,
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
  if (!nfts || (nfts.total === 0 && spamNFTs.size === 0)) {
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

  return (
    <div className="space-y-4 pb-20">
      {/* Заголовок и режим выбора */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-primary">Галерея NFT</h2>
        
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
                const isHotStaked = nfts?.hotStaked?.some(
                  h => h.contract === nft.contract && h.token_id === nft.token_id
                );

                return (
                  <div
                    key={idx}
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
