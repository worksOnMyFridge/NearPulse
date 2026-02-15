import { Zap } from 'lucide-react';
import { analytics } from '../lib/mockData';

export default function AnalyticsScreen({ selectedPeriod }) {
  const data = analytics[selectedPeriod] || analytics.week;

  const categoryLabels = {
    gaming: '\u{1F3AE} Gaming',
    defi: '\u{1F4B0} DeFi',
    transfers: '\u{1F4E4} Переводы',
    nft: '\u{1F3A8} NFT',
  };

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
              {(data.gasSpent / data.totalTxs).toFixed(4)} N
            </div>
            <div className="text-xs text-gray-500 mt-1">за транзакцию</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-500 mb-2">Gas по протоколам:</div>
          {data.topContracts.map((contract, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span>{contract.icon}</span>
                <span>{contract.name}</span>
              </div>
              <div className="text-sm font-semibold">{contract.gas.toFixed(4)} N</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity by Category */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Активность по категориям</h3>

        {Object.entries(data.breakdown).map(([key, val]) => (
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
                <div className="font-semibold mt-1">${(val.usd / val.count).toFixed(2)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
