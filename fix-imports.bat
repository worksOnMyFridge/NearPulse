@echo off
chcp 65001 >nul
echo ========================================
echo 🔧 Исправление импортов и настройки
echo ========================================
echo.

echo 📦 Добавляем исправленные файлы...
git add webapp/src/components/OverviewScreen.jsx
git add railway-bot.json
git add RAILWAY_SETUP.md
echo ✅ Файлы добавлены
echo.

echo 📝 Создаём коммит...
git commit -m "fix: remove unused imports and add bot config" -m "Changes:" -m "- Remove unused fetchNFTs import from OverviewScreen" -m "- Remove unused nfts state variables" -m "- Add railway-bot.json for bot service" -m "- Add RAILWAY_SETUP.md with instructions"

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
echo 📍 ВАЖНО: Настройте Railway!
echo.
echo Откройте RAILWAY_SETUP.md для инструкций
echo.
echo Вам нужно создать 2 сервиса на Railway:
echo 1. API Service (node src/api.js)
echo 2. Bot Service (node src/index.js)
echo.
echo Подробности в RAILWAY_SETUP.md
echo.
pause
