import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { fetchUserBalance } from './services/api';
import Header from './components/Header';
import OverviewScreen from './components/OverviewScreen';
import TransactionsScreen from './components/TransactionsScreen';
import AnalyticsScreen from './components/AnalyticsScreen';
import GalleryScreen from './components/GalleryScreen';
import LoadingSpinner from './components/LoadingSpinner';

export default function App() {
  const { tg, address } = useTelegram();
  const [currentScreen, setCurrentScreen] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [balanceData, setBalanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const displayAddress = address || 'leninjiv23.tg'; // Используем реальный адрес для демо

  useEffect(() => {
    try {
      tg.ready();
      tg.expand();
    } catch {
      // Not in Telegram environment
    }
  }, []);

  // Загружаем данные баланса при монтировании и при смене адреса
  useEffect(() => {
    async function loadBalance() {
      try {
        setLoading(true);
        setError(null);
        console.log('[App] Загружаем баланс для:', displayAddress);
        
        const data = await fetchUserBalance(displayAddress);
        console.log('[App] Баланс получен:', data);
        
        setBalanceData(data);
      } catch (err) {
        console.error('[App] Ошибка загрузки баланса:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadBalance();
  }, [displayAddress]);

  // Показываем загрузку
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto min-h-screen bg-primary">
        <Header
          address={displayAddress}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
        <div className="p-4 pb-6">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  // Показываем ошибку
  if (error) {
    return (
      <div className="max-w-2xl mx-auto min-h-screen bg-primary">
        <Header
          address={displayAddress}
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
        <div className="p-4 pb-6">
          <div className="glass-card rounded-xl p-4 text-center border-red-500/30">
            <div className="text-2xl mb-2">⚠️</div>
            <div className="text-primary font-medium mb-1">Ошибка загрузки данных</div>
            <div className="text-secondary text-sm">{error}</div>
            <div className="text-xs text-tertiary mt-2">
              Проверьте что API запущен
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-primary">
      <Header
        address={displayAddress}
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
      />

      <div className="p-4 pb-6 bg-secondary">
        {currentScreen === 'overview' && (
          <OverviewScreen
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            balanceData={balanceData}
          />
        )}
        {currentScreen === 'transactions' && <TransactionsScreen />}
        {currentScreen === 'analytics' && (
          <AnalyticsScreen selectedPeriod={selectedPeriod} />
        )}
        {currentScreen === 'gallery' && <GalleryScreen />}
      </div>
    </div>
  );
}
