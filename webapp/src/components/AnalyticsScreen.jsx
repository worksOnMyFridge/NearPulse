import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { fetchAnalytics } from '../services/api';
import { useTelegram } from '../hooks/useTelegram';
import LoadingSpinner from './LoadingSpinner';

export default function AnalyticsScreen({ selectedPeriod }) {
  const { address } = useTelegram();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const displayAddress = address || 'leninjiv23.tg';

  // Загружаем аналитику при изменении периода
  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        setError(null);
        console.log('[AnalyticsScreen] Загружаем аналитику для:', displayAddress, 'период:', selectedPeriod);
        
        const analytics = await fetchAnalytics(displayAddress, selectedPeriod);
        console.log('[AnalyticsScreen] Аналитика получена:', analytics);
        
        setData(analytics);
      } catch (err) {
        console.error('[AnalyticsScreen] Ошибка загрузки аналитики:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [displayAddress, selectedPeriod]);

  const categoryLabels = {
    gaming: '🎮 Gaming',
    defi: '💰 DeFi',
    transfers: '📤 Переводы',
    nft: '🎨 NFT',
  };

  // Показываем загрузку
  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSpinner />
      </div>
    );
  }

  // Показываем ошибку
  if (error) {
    return (
      <div className="space-y-4">
        <div className="glass-card rounded-xl p-4 text-center border-red-500/30">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-primary font-medium mb-1">Ошибка загрузки аналитики</div>
          <div className="text-secondary text-sm">{error}</div>
        </div>
      </div>
    );
  }

  // Если нет данных
  if (!data || data.totalTxs === 0) {
    return (
      <div className="space-y-4">
        <div className="glass-card rounded-xl p-4 text-center">
          <div className="text-4xl mb-2">📭</div>
          <div className="text-primary font-medium mb-1">Нет транзакций</div>
          <div className="text-secondary text-sm">За выбранный период транзакций не найдено</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gas Analytics */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Gas аналитика</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Всего потрачено</div>
            <div className="text-2xl font-bold text-gray-900">{data.gasSpent.toFixed(3)} N</div>
            <div className="text-xs text-gray-500 mt-1">${data.gasUSD}</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-1">Средний gas/tx</div>
            <div className="text-2xl font-bold text-gray-900">
              {data.totalTxs > 0 ? (data.gasSpent / data.totalTxs).toFixed(4) : '0.0000'} N
            </div>
            <div className="text-xs text-gray-500 mt-1">за транзакцию</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 mb-2">Gas по протоколам:</div>
          {data.topContracts.length > 0 ? (
            data.topContracts.map((contract, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm flex-1">
                  <span className="text-lg">{contract.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{contract.name}</div>
                    <div className="text-xs text-gray-500">{contract.percent}% от общего gas</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{contract.gas.toFixed(4)} N</div>
                  <div className="text-xs text-gray-500">{contract.txs} txs</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500 text-center py-2">Нет данных</div>
          )}
        </div>
      </div>

      {/* Activity by Category */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Активность по категориям</h3>

        {Object.entries(data.breakdown).map(([key, val]) => {
          // Пропускаем категории с 0 транзакций
          if (val.count === 0) return null;
          
          return (
            <div key={key} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">{categoryLabels[key]}</div>
                <div className="text-sm font-semibold">{val.count} транзакций</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Доля</div>
                  <div className="font-semibold mt-1">{val.percent}%</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Объем</div>
                  <div className="font-semibold mt-1">${val.usd.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Среднее</div>
                  <div className="font-semibold mt-1">
                    ${val.count > 0 ? (val.usd / val.count).toFixed(2) : '0.00'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
