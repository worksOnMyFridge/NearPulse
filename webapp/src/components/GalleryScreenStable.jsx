import { useState } from 'react';
import { Image, Loader, AlertCircle, Sparkles } from 'lucide-react';
import { fetchNFTs } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';

export default function GalleryScreenStable() {
  const { address } = useTelegram();
  const [nfts, setNfts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const displayAddress = address || 'leninjiv23.tg';

  // Ручная загрузка NFT
  const handleLoadNFTs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const nftData = await fetchNFTs(displayAddress);
      
      // Проверяем на ошибку в ответе
      if (nftData.error) {
        setError(nftData.error === 'NFT_TIMEOUT' 
          ? 'Загрузка NFT превысила время ожидания. Попробуйте позже.' 
          : 'Не удалось загрузить NFT. Попробуйте позже.');
        setNfts(null);
      } else {
        setNfts(nftData);
        setHasLoaded(true);
      }
    } catch (err) {
      console.error('Error loading NFTs:', err);
      setError('Произошла ошибка при загрузке NFT');
      setNfts(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Заголовок */}
      <div>
        <h2 className="text-xl font-bold text-primary">Галерея NFT</h2>
        <p className="text-xs text-secondary mt-1">
          ⚠️ Экспериментальная функция. Загрузка может занять время.
        </p>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="glass-card rounded-xl p-4 border border-orange-500/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-primary mb-1">Ошибка загрузки</div>
              <div className="text-xs text-secondary">{error}</div>
              <button
                onClick={handleLoadNFTs}
                disabled={loading}
                className="mt-3 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-600 rounded-lg text-xs font-medium transition-colors"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Кнопка загрузки */}
      {!hasLoaded && !loading && !error && (
        <div className="glass-card rounded-xl p-6 text-center">
          <div className="text-6xl mb-4">🎨</div>
          <h3 className="text-lg font-bold text-primary mb-2">NFT Галерея</h3>
          <p className="text-sm text-secondary mb-6">
            Нажмите кнопку ниже, чтобы загрузить ваши NFT.
            <br />
            Это может занять 10-30 секунд.
          </p>
          <button
            onClick={handleLoadNFTs}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
          >
            🚀 Загрузить NFT (Экспериментально)
          </button>
        </div>
      )}

      {/* Индикатор загрузки */}
      {loading && (
        <div className="glass-card rounded-xl p-8 text-center">
          <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <div className="text-primary font-medium mb-2">Загружаем NFT...</div>
          <div className="text-sm text-secondary">Это может занять до 30 секунд</div>
        </div>
      )}

      {/* Результаты */}
      {!loading && hasLoaded && nfts && (
        <div className="space-y-4">
          {/* Статистика */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card rounded-xl p-4">
              <div className="text-2xl font-bold text-primary">{nfts.wallet?.length || 0}</div>
              <div className="text-xs text-secondary">NFT в кошельке</div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <div className="text-2xl font-bold text-orange-600">{nfts.hotStaked?.length || 0}</div>
              <div className="text-xs text-secondary">🔥 HOT Craft</div>
            </div>
          </div>

          {/* Список NFT */}
          {(nfts.wallet?.length > 0 || nfts.hotStaked?.length > 0) ? (
            <div className="space-y-4">
              {/* Wallet NFTs */}
              {nfts.wallet?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Кошелёк ({nfts.wallet.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {nfts.wallet.map((nft, idx) => (
                      <div key={idx} className="glass-card rounded-lg p-3">
                        <div className="aspect-square rounded-lg bg-glass-hover mb-2 flex items-center justify-center overflow-hidden">
                          {nft.media ? (
                            <img 
                              src={nft.media} 
                              alt={nft.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full flex items-center justify-center" style={{ display: nft.media ? 'none' : 'flex' }}>
                            <Image className="w-8 h-8 text-secondary" />
                          </div>
                        </div>
                        <div className="text-xs font-medium text-primary truncate">{nft.title || nft.token_id}</div>
                        <div className="text-xs text-secondary truncate">ID: {nft.token_id.substring(0, 10)}...</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HOT Staked NFTs */}
              {nfts.hotStaked?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-orange-600 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    HOT Craft ({nfts.hotStaked.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {nfts.hotStaked.map((nft, idx) => (
                      <div key={idx} className="glass-card rounded-lg p-3 border border-orange-500/30">
                        <div className="aspect-square rounded-lg bg-glass-hover mb-2 flex items-center justify-center overflow-hidden relative">
                          {nft.media ? (
                            <img 
                              src={nft.media} 
                              alt={nft.title} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full flex items-center justify-center" style={{ display: nft.media ? 'none' : 'flex' }}>
                            <Image className="w-8 h-8 text-secondary" />
                          </div>
                          <div className="absolute top-2 left-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg px-2 py-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-white" />
                            <span className="text-xs text-white font-medium">HOT</span>
                          </div>
                        </div>
                        <div className="text-xs font-medium text-primary truncate">{nft.title || nft.token_id}</div>
                        <div className="text-xs text-secondary truncate">ID: {nft.token_id.substring(0, 10)}...</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-6 text-center">
              <div className="text-4xl mb-2">🎨</div>
              <div className="text-primary font-medium mb-1">Нет NFT</div>
              <div className="text-secondary text-sm">У вас пока нет NFT в коллекции</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
