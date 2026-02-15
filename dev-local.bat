@echo off
chcp 65001 >nul
cls

echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║    🔧 NEAR Analytics Bot - Локальная Разработка          ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo ℹ️  Telegram бот уже работает на Railway
echo ℹ️  Frontend уже работает на Vercel
echo.
echo 🎯 Запускаем только API локально для тестирования
echo.

:: Проверка зависимостей
if not exist "node_modules\" (
    echo ❌ Backend зависимости не установлены!
    echo.
    echo Запустите: install.bat
    echo.
    pause
    exit /b 1
)

if not exist "webapp\node_modules\" (
    echo ❌ Frontend зависимости не установлены!
    echo.
    echo Запустите: install.bat
    echo.
    pause
    exit /b 1
)

echo ✅ Зависимости установлены
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo 🚀 Запускаю Backend API и Frontend для разработки...
echo.
echo Backend API:  http://localhost:3001
echo Frontend:     http://localhost:5173
echo.
echo ⚠️  НЕ ЗАКРЫВАЙТЕ ОТКРЫВШИЕСЯ ОКНА!
echo.
echo ════════════════════════════════════════════════════════════
echo.

:: Запуск только API (без бота)
start "NEAR Bot - API Server (Local Dev)" cmd /k "node src/api.js"
timeout /t 2 /nobreak >nul

:: Запуск Frontend
start "NEAR Bot - Frontend (Local Dev)" cmd /k "cd webapp && npm run dev"

echo.
echo ✅ Серверы запущены!
echo.
echo 📝 Для тестирования:
echo    1. Откройте http://localhost:5173
echo    2. API доступен на http://localhost:3001
echo    3. Telegram бот работает на Railway (production)
echo.
echo 💡 Изменения в коде обновятся автоматически (hot reload)
echo.
echo ════════════════════════════════════════════════════════════
echo.

pause
