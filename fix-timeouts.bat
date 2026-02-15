@echo off
chcp 65001 >nul
echo ========================================
echo 🔧 Исправление таймаутов
echo ========================================
echo.

echo 📦 Добавляем исправления...
git add src/config/constants.js
git add src/api.js
git add webapp/src/components/OverviewScreen.jsx
echo ✅ Файлы добавлены
echo.

echo 📝 Создаём коммит...
git commit -m "fix: increase timeouts and remove unused imports" -m "Changes:" -m "- Increase API_TIMEOUT from 10s to 30s" -m "- Add request/response timeouts (60s) in Express" -m "- Remove unused NFT imports from OverviewScreen" -m "This should prevent Railway container from stopping"

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
echo ✅ Исправления отправлены!
echo ========================================
echo.
echo 📍 Railway автоматически задеплоит через 2-3 минуты
echo.
echo 🧪 Проверьте после деплоя:
echo 1. Откройте Bot в Telegram - /start
echo 2. Откройте приложение - проверьте транзакции
echo 3. Перейдите в Аналитику - не должно падать
echo.
pause
