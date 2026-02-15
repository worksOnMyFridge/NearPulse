import { useState, useEffect } from 'react';
import { Clock, ExternalLink } from 'lucide-react';
import { fetchTransactions } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ru';

dayjs.extend(relativeTime);
dayjs.locale('ru');

export default function TransactionsScreen() {
  const { address } = useTelegram();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
              
              {/* Time and Link */}
              <div className="flex items-center gap-2 text-xs text-secondary mb-3">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{dayjs(tx.timestamp).fromNow()}</span>
                </div>
                <span>&bull;</span>
                <a 
                  href={`https://nearblocks.io/txns/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-400 transition"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Action Buttons Placeholder - место под будущие кнопки */}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="px-3 py-1.5 glass-subtle rounded-lg text-xs text-secondary cursor-not-allowed">
                  {/* Placeholder для будущих кнопок действий */}
                </div>
              </div>
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
  );
}
