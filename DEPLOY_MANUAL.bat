@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 Ручной деплой (шаг за шагом)
echo ========================================
echo.

echo 📍 Шаг 1: Синхронизация с GitHub
echo Выполните команды:
echo.
echo git pull origin main --rebase
echo.
pause

echo.
echo 📍 Шаг 2: Проверка статуса
echo Выполните:
echo.
echo git status
echo.
pause

echo.
echo 📍 Шаг 3: Отправка на GitHub
echo Выполните:
echo.
echo git push origin main
echo.
pause

echo.
echo ========================================
echo ✅ Если всё прошло успешно:
echo ========================================
echo.
echo 1. Railway автоматически задеплоит через 1-2 минуты
echo 2. Vercel автоматически обновит фронтенд
echo.
echo 🧪 Тестирование:
echo.
echo curl https://your-api.railway.app/api/health
echo curl https://your-api.railway.app/api/nfts/count/leninjiv23.tg
echo.
pause
