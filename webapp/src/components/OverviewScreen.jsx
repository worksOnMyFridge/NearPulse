import { Activity, Zap, Sparkles, TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { analytics } from '../lib/mockData';

export default function OverviewScreen({ selectedPeriod, onPeriodChange }) {
  const data = analytics[selectedPeriod] || analytics.week;
  const maxActivity = Math.max(...data.activityByDay.map(d => d.txs));

  const categoryLabels = {
    gaming: '\u{1F3AE} Gaming',
    defi: '\u{1F4B0} DeFi',
    transfers: '\u{1F4E4} Переводы',
    nft: '\u{1F3A8} NFT',
  };

  const categoryColors = {
    gaming: 'bg-purple-500',
    defi: 'bg-green-500',
    transfers: 'bg-blue-500',
    nft: 'bg-pink-500',
  };

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'week', label: '7 дней' },
          { key: 'month', label: '30 дней' },
          { key: 'all', label: 'Всё время' },
        ].map(period => (
          <button
            key={period.key}
            onClick={() => onPeriodChange(period.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              selectedPeriod === period.key
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Insights */}
      <div className="space-y-2">
        {data.insights.map((insight, idx) => (
          <div key={idx} className="bg-white rounded-xl p-4 flex items-start gap-3 border border-gray-100">
            <div className="text-2xl">{insight.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{insight.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 opacity-80" />
            <div className="text-xs opacity-80">Транзакций</div>
          </div>
          <div className="text-3xl font-bold">{data.totalTxs}</div>
          <div className="text-xs opacity-80 mt-1">за период</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 opacity-80" />
            <div className="text-xs opacity-80">Gas расходы</div>
          </div>
          <div className="text-3xl font-bold">{data.gasSpent.toFixed(3)}</div>
          <div className="text-xs opacity-80 mt-1">NEAR (${data.gasUSD})</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 opacity-80" />
            <div className="text-xs opacity-80">Контрактов</div>
          </div>
          <div className="text-3xl font-bold">{data.uniqueContracts}</div>
          <div className="text-xs opacity-80 mt-1">уникальных</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 opacity-80" />
            <div className="text-xs opacity-80">Самый активный</div>
          </div>
          <div className="text-lg font-bold mt-2">{data.mostActive}</div>
          <div className="text-xs opacity-80">протокол</div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Активность по дням</h3>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>

        <div className="flex items-end justify-between gap-2 h-32">
          {data.activityByDay.map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '100%' }}>
                <div
                  className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all"
                  style={{ height: `${(day.txs / maxActivity) * 100}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 font-medium">{day.day}</div>
              <div className="text-xs font-bold text-gray-700">{day.txs}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">По категориям</h3>
          <PieChart className="w-5 h-5 text-gray-400" />
        </div>

        <div className="space-y-3">
          {Object.entries(data.breakdown).map(([key, val]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">{categoryLabels[key]}</div>
                  <div className="text-xs text-gray-500">{val.count} txs</div>
                </div>
                <div className="text-sm font-semibold text-gray-900">{val.percent}%</div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${categoryColors[key]}`}
                  style={{ width: `${val.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Contracts */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3">Топ протоколы</h3>

        <div className="space-y-2">
          {data.topContracts.map((contract, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{contract.icon}</div>
                <div>
                  <div className="font-medium text-sm">{contract.name}</div>
                  <div className="text-xs text-gray-500">{contract.category}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{contract.txs} txs</div>
                <div className="text-xs text-gray-500">{contract.gas.toFixed(3)} N gas</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
