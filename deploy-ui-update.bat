@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║   🎨 UI/UX Update Deployment 🎨    ║
echo ╚══════════════════════════════════════╝
echo.

echo [1/4] 📦 Устанавливаем зависимости webapp...
cd webapp
call npm install
if errorlevel 1 (
  echo ❌ Ошибка установки зависимостей
  pause
  exit /b 1
)
cd ..

echo.
echo [2/4] 📝 Коммитим изменения...
git add .
git commit -m "feat: Add modern UI/UX with Dark/Light theme system

- Implemented CSS variables theme system
- Added glassmorphism effects for Dark Mode
- Created ThemeContext and theme toggle (☀️/🌙)
- Updated all components with new theme-aware styles
- Made Balance Card clickable with info icon
- Added placeholder for future action buttons in transactions
- Improved hover effects and transitions
- Added colored left borders for different transaction types
- Optimized for both Dark and Light modes"

if errorlevel 1 (
  echo ⚠️  Нет изменений для коммита или ошибка
)

echo.
echo [3/4] ☁️  Пушим в GitHub...
git push
if errorlevel 1 (
  echo ❌ Ошибка при push
  pause
  exit /b 1
)

echo.
echo [4/4] 🔄 Ждем деплоя...
echo.
echo ⏳ Vercel Frontend деплоится (~2-3 минуты)
echo    https://vercel.com/dashboard
echo.
timeout /t 5 /nobreak >nul

echo.
echo ╔══════════════════════════════════════╗
echo ║    ✅ UI/UX Update Deployed! ✅     ║
echo ╚══════════════════════════════════════╝
echo.
echo 🎨 Новые возможности:
echo    ✅ Dark/Light mode переключатель
echo    ✅ Glassmorphism эффекты
echo    ✅ Кликабельная карточка портфеля
echo    ✅ Улучшенные transitions
echo    ✅ Цветные границы транзакций
echo.
echo 🧪 Проверьте:
echo    1. Переключатель тем в шапке (☀️/🌙)
echo    2. Glassmorphism в Dark Mode
echo    3. Hover эффекты на карточках
echo    4. Цветные границы транзакций
echo.
pause
