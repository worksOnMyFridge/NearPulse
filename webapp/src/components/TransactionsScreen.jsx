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
      <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
        <div className="text-sm text-gray-500">Загружаем транзакции...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-4 border border-red-200">
        <div className="text-2xl mb-2 text-center">⚠️</div>
        <div className="text-red-800 font-medium text-center mb-1">Ошибка загрузки</div>
        <div className="text-red-600 text-sm text-center">{error}</div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
        <div className="text-4xl mb-3">📭</div>
        <div className="text-gray-700 font-medium mb-1">Нет транзакций</div>
        <div className="text-sm text-gray-500">История транзакций пока пуста</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map(tx => (
        <div key={tx.hash} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="text-2xl mt-0.5 flex-shrink-0">{tx.icon}</div>
            
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Description */}
              <div className="font-semibold text-sm mb-1 truncate">{tx.description}</div>
              
              {/* Time and Link */}
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{dayjs(tx.timestamp).fromNow()}</span>
                </div>
                <span>&bull;</span>
                <a 
                  href={`https://nearblocks.io/txns/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-600 transition"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Amount */}
              {tx.amount > 0.01 && (
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-base text-gray-900">
                    {parseFloat(tx.amountFormatted).toFixed(2)} NEAR
                  </span>
                  {tx.usdValue && (
                    <span className="text-xs text-gray-500">
                      ≈ ${tx.usdValue.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
              
              {/* Token Name for token transfers */}
              {tx.tokenName && (
                <div className="mt-1 inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                  {tx.tokenName}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Show More Button */}
      {transactions.length >= 10 && (
        <button className="w-full bg-gray-100 text-gray-700 rounded-xl py-3 text-sm font-medium hover:bg-gray-200 transition">
          Показать еще
        </button>
      )}
    </div>
  );
}
