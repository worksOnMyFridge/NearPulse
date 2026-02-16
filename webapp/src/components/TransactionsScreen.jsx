import { useState, useEffect } from 'react';
import { Clock, ExternalLink, Copy, Info, Globe } from 'lucide-react';
import { fetchTransactions } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';
import Toast from './Toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

function normalizeTimestamp(ts) {
  if (!ts) return 0;
  const n = Number(ts);
  if (n > 1e18) return n / 1e6;   // наносекунды → миллисекунды
  if (n > 1e15) return n / 1e3;   // микросекунды → миллисекунды
  if (n > 1e12) return n;          // уже миллисекунды
  return n * 1000;                  // секунды → миллисекунды
}

export default function TransactionsScreen() {
  const { address } = useTelegram();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTx, setExpandedTx] = useState(null);
  const [toast, setToast] = useState(null);

  const displayAddress = address || 'leninjiv23.tg';

  useEffect(() => {
    async function loadTransactions() {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchTransactions(displayAddress, 10);
        setTransactions(data.transactions);
      } catch (err) {
        console.error('Error loading transactions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [displayAddress]);

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
        <div className="text-sm text-secondary">Загружаем транзакции...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-xl p-4 border-red-500/30">
        <div className="text-2xl mb-2 text-center">⚠️</div>
        <div className="text-primary font-medium text-center mb-1">Ошибка загрузки</div>
        <div className="text-secondary text-sm text-center">{error}</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">📭</div>
        <div className="text-primary font-medium mb-1">Нет транзакций</div>
        <div className="text-sm text-secondary">История транзакций пока пуста</div>
      </div>
    );
  }

  // Функция копирования хеша
  const copyToClipboard = async (hash) => {
    try {
      await navigator.clipboard.writeText(hash);
      setToast('Хеш скопирован!');
    } catch (err) {
      console.error('Failed to copy:', err);
      setToast('Ошибка копирования');
    }
  };

  // Функция переключения деталей
  const toggleDetails = (hash) => {
    setExpandedTx(expandedTx === hash ? null : hash);
  };

  // Определяем цвет границы и свечение по типу транзакции
  const getBorderStyles = (type) => {
    const styles = {
      hot_claim: 'border-l-4 border-l-orange-500 hover:shadow-orange-500/20',
      claim: 'border-l-4 border-l-yellow-500 hover:shadow-yellow-500/20',
      swap: 'border-l-4 border-l-blue-500 hover:shadow-blue-500/20',
      transfer_in: 'border-l-4 border-l-green-500 hover:shadow-green-500/20',
      token_in: 'border-l-4 border-l-green-500 hover:shadow-green-500/20',
      transfer_out: 'border-l-4 border-l-red-500 hover:shadow-red-500/20',
      token_out: 'border-l-4 border-l-red-500 hover:shadow-red-500/20',
    };
    return styles[type] || 'border-l-4 border-l-gray-400 hover:shadow-gray-400/20';
  };

  return (
    <>
      <div className="space-y-3">
        {transactions.map(tx => (
          <div 
            key={tx.hash} 
            className={`glass-card rounded-xl p-4 ${getBorderStyles(tx.type)} group`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="text-2xl mt-0.5 flex-shrink-0">{tx.icon}</div>
              
              {/* Main Content */}
              <div className="flex-1 min-w-0">
                {/* Description */}
                <div className="font-semibold text-sm mb-1 text-primary">{tx.description}</div>
                
                {/* Token Badge - показываем сверху если есть */}
                {tx.tokenName && (
                  <div className="mb-2 inline-block px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full font-medium border border-purple-500/30">
                    {tx.tokenName}
                  </div>
                )}

                {/* Amount - показываем только если есть NEAR */}
                {tx.amount > 0.01 && (
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-bold text-base text-primary">
                      {parseFloat(tx.amountFormatted).toFixed(2)} NEAR
                    </span>
                    {tx.usdValue && (
                      <span className="text-xs text-secondary">
                        ≈ ${tx.usdValue.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Time */}
                <div className="flex items-center gap-1 text-xs text-secondary mb-3">
                  <Clock className="w-3 h-3" />
                  <span>{dayjs(normalizeTimestamp(tx.timestamp)).fromNow()}</span>
                </div>

                {/* Action Buttons - появляются при hover */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 animate-fade-in">
                  {/* Explorer Button */}
                  <a
                    href={`https://nearblocks.io/txns/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 glass-subtle rounded-lg text-xs text-secondary hover:text-blue-400 hover:border-blue-400/30 transition-all border border-transparent"
                    title="Открыть в Explorer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Explorer</span>
                  </a>

                  {/* Copy Button */}
                  <button
                    onClick={() => copyToClipboard(tx.hash)}
                    className="flex items-center gap-1.5 px-3 py-1.5 glass-subtle rounded-lg text-xs text-secondary hover:text-green-400 hover:border-green-400/30 transition-all border border-transparent"
                    title="Копировать хеш"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Копировать</span>
                  </button>

                  {/* Details Button */}
                  <button
                    onClick={() => toggleDetails(tx.hash)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 glass-subtle rounded-lg text-xs transition-all border ${
                      expandedTx === tx.hash
                        ? 'text-purple-400 border-purple-400/30'
                        : 'text-secondary hover:text-purple-400 hover:border-purple-400/30 border-transparent'
                    }`}
                    title="Показать детали"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{expandedTx === tx.hash ? 'Скрыть' : 'Детали'}</span>
                  </button>
                </div>

                {/* Expanded Details - разворачивается при клике */}
                {expandedTx === tx.hash && (
                  <div className="mt-3 pt-3 border-t border-glass animate-fade-in">
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-secondary">Статус:</span>
                        <span className="text-green-400 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                          Успешно
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-secondary">Gas Fee:</span>
                        <span className="text-primary font-medium">~0.0001 NEAR</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-secondary">Хеш:</span>
                        <span className="text-primary font-mono text-[10px] break-all max-w-[200px] text-right">
                          {tx.hash}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Show More Button */}
        {transactions.length >= 10 && (
          <button className="w-full glass-card rounded-xl py-3 text-sm font-medium text-primary hover:scale-[1.02] transition-transform">
            Показать еще
          </button>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
