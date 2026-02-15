import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Header({ address, currentScreen, onScreenChange }) {
  const { theme, toggleTheme } = useTheme();
  
  const tabs = [
    { key: 'overview', label: 'Обзор' },
    { key: 'transactions', label: 'Транзакции' },
    { key: 'analytics', label: 'Аналитика' },
    { key: 'gallery', label: '🎨 Галерея' },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white sticky top-0 z-10 shadow-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
              NP
            </div>
            <div>
              <div className="font-bold text-lg">NearPulse</div>
              <div className="text-xs opacity-80">Transaction Intelligence</div>
            </div>
          </div>
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-all duration-300 shadow-lg hover:scale-110"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-yellow-300" />
            ) : (
              <Moon className="w-5 h-5 text-blue-300" />
            )}
          </button>
        </div>

        {address && (
          <div className="flex items-center gap-2 text-sm glass-subtle rounded-lg px-3 py-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse-dot shadow-lg"></div>
            <span className="opacity-90 font-medium">{address}</span>
          </div>
        )}
      </div>

      <div className="flex border-t border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onScreenChange(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition-all duration-200 relative ${
              currentScreen === tab.key ? 'text-white' : 'text-white/60 hover:text-white/80'
            }`}
          >
            {tab.label}
            {currentScreen === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-lg"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
