@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║   🔧 NearPulse WebApp Fix 🔧       ║
echo ╚══════════════════════════════════════╝
echo.

echo [1/3] 📝 Коммитим исправления...
git add .
git commit -m "fix: Fix HOT claim timer and improve transactions display

- Fixed getHotClaimStatus to return correct format (canClaim, nextClaimTime)
- Added timestamp conversion from nanoseconds to milliseconds
- Improved transaction descriptions (shortened addresses)
- Added colored left borders for different transaction types
- Changed token transfer icon to 🪙
- Better UI layout (token badge above amount)"

if errorlevel 1 (
  echo ⚠️  Нет изменений для коммита или ошибка
)

echo.
echo [2/3] ☁️  Пушим в GitHub...
git push
if errorlevel 1 (
  echo ❌ Ошибка при push
  pause
  exit /b 1
)

echo.
echo [3/3] 🔄 Ждем деплоя...
echo.
echo ⏳ Railway API деплоится (~2-3 минуты)
echo    https://railway.app/project
echo.
echo ⏳ Vercel Frontend деплоится (~2-3 минуты)
echo    https://vercel.com/dashboard
echo.
timeout /t 5 /nobreak >nul

echo.
echo ╔══════════════════════════════════════╗
echo ║        ✅ Исправления отправлены!   ║
echo ╚══════════════════════════════════════╝
echo.
echo 📋 Что исправлено:
echo    ✅ HOT таймер теперь показывает время
echo    ✅ Транзакции с цветными границами
echo    ✅ Улучшенные описания
echo    ✅ Правильное время транзакций
echo.
echo 🧪 После деплоя проверьте:
echo    1. HOT таймер на главной странице
echo    2. Вкладку "Транзакции"
echo    3. Цветные границы слева у карточек
echo.
pause
