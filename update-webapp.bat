@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║   🚀 NearPulse WebApp Update 🚀    ║
echo ╚══════════════════════════════════════╝
echo.

echo [1/5] 📦 Устанавливаем dayjs в webapp...
cd webapp
call npm install
if errorlevel 1 (
  echo ❌ Ошибка установки зависимостей
  pause
  exit /b 1
)
cd ..

echo.
echo [2/5] 📝 Коммитим изменения...
git add .
git commit -m "feat: Add real transactions, HOT claim timer to webapp

- Added /api/transactions and /api/hot-claim endpoints
- Updated TransactionsScreen with real data from API
- Added HOT claim timer to OverviewScreen
- Installed dayjs for relative time display
- Fixed data sync issues between frontend and backend"

if errorlevel 1 (
  echo ⚠️  Нет изменений для коммита или ошибка
)

echo.
echo [3/5] ☁️  Пушим в GitHub...
git push
if errorlevel 1 (
  echo ❌ Ошибка при push
  pause
  exit /b 1
)

echo.
echo [4/5] 🔄 Ждем деплоя Railway (API)...
echo Проверьте Railway Dashboard: https://railway.app/project
timeout /t 5 /nobreak >nul

echo.
echo [5/5] 🔄 Ждем деплоя Vercel (Frontend)...
echo Проверьте Vercel Dashboard: https://vercel.com
timeout /t 5 /nobreak >nul

echo.
echo ╔══════════════════════════════════════╗
echo ║        ✅ Деплой завершен! ✅        ║
echo ╚══════════════════════════════════════╝
echo.
echo 📱 Откройте ваш сайт через несколько минут
echo 🤖 Бот автоматически обновится на Railway
echo.
pause
