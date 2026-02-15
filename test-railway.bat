@echo off
chcp 65001 >nul
echo ========================================
echo 🧪 Тестирование Railway API
echo ========================================
echo.

set API_URL=https://nearpulse-production.up.railway.app

echo 📍 Test 1: Health Check
curl -s %API_URL%/api/health
echo.
echo.

echo 📍 Test 2: Balance
curl -s %API_URL%/api/balance/leninjiv23.tg
echo.
echo.

echo 📍 Test 3: Transactions
curl -s %API_URL%/api/transactions/leninjiv23.tg?limit=3
echo.
echo.

echo 📍 Test 4: Analytics
curl -s %API_URL%/api/analytics/leninjiv23.tg?period=week
echo.
echo.

echo 📍 Test 5: NFTs
curl -s %API_URL%/api/nfts/leninjiv23.tg
echo.
echo.

echo ========================================
echo ✅ Тесты завершены
echo ========================================
echo.
echo Если видите ошибки 500:
echo 1. Откройте Railway Dashboard
echo 2. Перейдите в Deploy Logs
echo 3. Найдите красную ошибку
echo 4. Покажите мне скриншот
echo.
pause
