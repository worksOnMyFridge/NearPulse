import { useState } from 'react';
import { Filter, Clock, Zap, ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { transactions } from '../lib/mockData';

export default function TransactionsScreen() {
  const [expandedTxs, setExpandedTxs] = useState(new Set());

  const toggleTx = (id) => {
    setExpandedTxs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Фильтры</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['Все', 'Gaming', 'DeFi', 'Transfers', 'NFT'].map(filter => (
            <button
              key={filter}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {transactions.map(tx => (
          <div key={tx.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div
              onClick={() => tx.txCount > 1 ? toggleTx(tx.id) : null}
              className="p-4 hover:bg-gray-50 transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1">
                  <div className="text-2xl mt-0.5">{tx.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-0.5">{tx.action}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{tx.protocol}</span>
                      <span>&bull;</span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded-full">{tx.category}</span>
                    </div>
                  </div>
                </div>

                {tx.txCount > 1 ? (
                  expandedTxs.has(tx.id) ?
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" /> :
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {tx.time}
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {tx.gas.toFixed(4)} N
                  </div>
                  {tx.txCount > 1 && (
                    <div className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">
                      {tx.txCount} txs
                    </div>
                  )}
                </div>

                <div className={`text-sm font-semibold ${tx.result.startsWith('+') ? 'text-green-600' : 'text-gray-600'}`}>
                  {tx.result}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedTxs.has(tx.id) && tx.grouped && (
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                <div className="text-xs font-semibold text-gray-500 mb-3">Шаги транзакции:</div>
                <div className="space-y-2">
                  {tx.grouped.map((step, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Шаг {idx + 1}</div>
                          <div className="font-medium text-sm">{step.action}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{step.contract}</div>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {step.gas.toFixed(4)} N
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-3 bg-blue-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2">
                  Посмотреть в Explorer
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
