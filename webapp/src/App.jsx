import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import Header from './components/Header';
import OverviewScreen from './components/OverviewScreen';
import TransactionsScreen from './components/TransactionsScreen';
import AnalyticsScreen from './components/AnalyticsScreen';

export default function App() {
  const { tg, address } = useTelegram();
  const [currentScreen, setCurrentScreen] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  useEffect(() => {
    try {
      tg.ready();
      tg.expand();
    } catch {
      // Not in Telegram environment
    }
  }, []);

  const displayAddress = address || 'demo.near';

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-50">
      <Header
        address={displayAddress}
        currentScreen={currentScreen}
        onScreenChange={setCurrentScreen}
      />

      <div className="p-4 pb-6">
        {currentScreen === 'overview' && (
          <OverviewScreen
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        )}
        {currentScreen === 'transactions' && <TransactionsScreen />}
        {currentScreen === 'analytics' && (
          <AnalyticsScreen selectedPeriod={selectedPeriod} />
        )}
      </div>
    </div>
  );
}
