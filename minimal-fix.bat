@echo off
chcp 65001 >nul
echo ========================================
echo ⚡ МИНИМАЛЬНЫЙ FIX
echo ========================================
echo.

echo Что сделано:
echo 1. CORS fix - разрешены все Vercel
echo 2. Price cache - 5 минут
echo 3. Транзакции ОТКЛЮЧЕНЫ временно (429)
echo 4. Аналитика ОТКЛЮЧЕНА временно (429)
echo.
echo Результат: Баланс будет работать!
echo.

git add src/services/nearService.js src/api.js src/config/constants.js webapp/src/components/OverviewScreen.jsx webapp/src/components/GalleryScreenStable.jsx webapp/src/App.jsx

git commit -m "emergency: disable analytics due to Nearblocks 429 rate limits" -m "All APIs blocked: Nearblocks, CoinGecko, Pikespeak" -m "Temporary fix: return empty arrays instead of crashes" -m "Balance still works, transactions/analytics disabled" -m "Need Nearblocks API key to restore full functionality"

git push origin master

echo.
echo ⏰ Подождите 3 минуты
echo ✅ Баланс должен заработать!
pause
