@echo off
chcp 65001 >nul
echo ========================================
echo 🚨 EMERGENCY FIX: Rate Limits
echo ========================================
echo.

echo Проблема: Nearblocks API блокирует (429)
echo Решение: Переключаемся на NEAR RPC (без лимитов)
echo.

echo 📦 Добавляем исправления...
git add src/services/nearService.js
git add src/api.js
git add src/config/constants.js
git add webapp/src/components/OverviewScreen.jsx
echo ✅ Файлы добавлены
echo.

echo 📝 Коммит...
git commit -m "emergency: switch to NEAR RPC to avoid rate limits" -m "Nearblocks/CoinGecko/Pikespeak all return 429" -m "Switched getTransactionHistory to NEAR RPC" -m "Added price cache 5min" -m "Fixed CORS for all Vercel deployments"

if %errorlevel% neq 0 (
    echo ❌ Ошибка
    pause
    exit /b 1
)

echo 🔄 Push...
git push origin master

echo.
echo ⏰ Ждите 3 минуты и проверяйте!
pause
