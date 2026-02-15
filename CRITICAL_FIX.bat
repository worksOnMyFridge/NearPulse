@echo off
chcp 65001 >nul
echo ========================================
echo 🚨 КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ
echo ========================================
echo.

echo Исправлено:
echo 1. CORS - разрешены все Vercel deployments
echo 2. Price cache - запросы к CoinGecko раз в 5 минут
echo 3. Fallback цена NEAR если API недоступен
echo 4. Таймауты увеличены до 30-60 секунд
echo.

echo 📦 Добавляем файлы...
git add src/api.js
git add src/services/nearService.js
git add src/config/constants.js
git add webapp/src/components/OverviewScreen.jsx
echo ✅ Файлы добавлены
echo.

echo 📝 Создаём коммит...
git commit -m "fix: critical CORS and rate limit issues" -m "Changes:" -m "- Fix CORS: allow all *.vercel.app origins" -m "- Add price cache (5 min TTL) to reduce CoinGecko requests" -m "- Add fallback NEAR price when API fails" -m "- Increase timeouts to 30-60s" -m "- Remove unused NFT imports" -m "This fixes: CORS errors, 429 rate limits, container stops"

if %errorlevel% neq 0 (
    echo ❌ Ошибка при создании коммита
    pause
    exit /b 1
)
echo ✅ Коммит создан
echo.

echo 🔄 Отправляем в GitHub...
git push origin master

if %errorlevel% neq 0 (
    echo ❌ Ошибка при push
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ ОТПРАВЛЕНЫ!
echo ========================================
echo.
echo ⏰ Подождите 3-4 минуты для деплоя
echo.
echo 🧪 Затем проверьте:
echo 1. Откройте приложение - должен загрузиться баланс
echo 2. Перейдите в транзакции - должны отобразиться
echo 3. Перейдите в аналитику - не должно падать
echo 4. Бот в Telegram - /start должен ответить
echo.
pause
