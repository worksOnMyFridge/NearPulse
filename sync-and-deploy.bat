@echo off
chcp 65001 >nul
echo ========================================
echo 🔄 Синхронизация и деплой
echo ========================================
echo.

echo 📥 Получаем изменения с GitHub...
git pull origin main --rebase

if %errorlevel% neq 0 (
    echo ❌ Ошибка при pull
    echo.
    echo 💡 Возможно есть конфликты. Проверьте:
    echo    git status
    pause
    exit /b 1
)
echo ✅ Синхронизация завершена
echo.

echo 📦 Проверяем статус...
git status --short
echo.

echo 🔄 Отправляем в GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo ❌ Ошибка при push
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Деплой завершён успешно!
echo ========================================
echo.
echo 📍 Следующие шаги:
echo 1. Railway: https://railway.app (автоматический деплой)
echo 2. Vercel: https://vercel.com (автоматический деплой)
echo 3. Проверь API: curl https://your-api.railway.app/api/health
echo.
echo 🧪 Тестирование:
echo - Счётчик NFT: curl https://your-api.railway.app/api/nfts/count/leninjiv23.tg
echo - Пагинация: curl "https://your-api.railway.app/api/nfts/leninjiv23.tg?page=1&limit=50"
echo.
pause
