import { Calendar } from 'lucide-react';

export default function Header({ address, currentScreen, onScreenChange }) {
  const tabs = [
    { key: 'overview', label: 'Обзор' },
    { key: 'transactions', label: 'Транзакции' },
    { key: 'analytics', label: 'Аналитика' },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white sticky top-0 z-10">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white font-bold">
              NP
            </div>
            <div>
              <div className="font-bold text-lg">NearPulse</div>
              <div className="text-xs opacity-80">Transaction Intelligence</div>
            </div>
          </div>
          <Calendar className="w-6 h-6 opacity-80" />
        </div>

        {address && (
          <div className="flex items-center gap-2 text-sm bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse-dot"></div>
            <span className="opacity-90">{address}</span>
          </div>
        )}
      </div>

      <div className="flex border-t border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onScreenChange(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition relative ${
              currentScreen === tab.key ? 'text-white' : 'text-white/60'
            }`}
          >
            {tab.label}
            {currentScreen === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
