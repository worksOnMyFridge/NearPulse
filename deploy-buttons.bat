@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║   🎯 Transaction Buttons Deploy 🎯  ║
echo ╚══════════════════════════════════════╝
echo.

echo [1/3] 📝 Коммитим изменения...
git add .
git commit -m "feat: Add functional transaction action buttons

- Added 3 action buttons (Explorer, Copy, Details)
- Implemented Toast notification component
- Added clipboard copy functionality
- Expandable transaction details
- Apple-style minimalist design
- Smooth animations (fade-in, slide-in)
- Mobile responsive (icon-only on small screens)
- Dark/Light mode support"

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
echo [3/3] 🔄 Ждем деплоя Vercel...
echo    https://vercel.com/dashboard
timeout /t 5 /nobreak >nul

echo.
echo ╔══════════════════════════════════════╗
echo ║    ✅ Transaction Buttons Deployed!  ║
echo ╚══════════════════════════════════════╝
echo.
echo 🎯 Новые возможности:
echo    ✅ 🌐 Explorer - открытие в Nearblocks
echo    ✅ 📋 Копировать - копия хеша с Toast
echo    ✅ 🔍 Детали - раскрытие доп. информации
echo.
echo 🧪 Проверьте:
echo    1. Наведите на транзакцию - появятся кнопки
echo    2. Нажмите "Копировать" - появится Toast
echo    3. Нажмите "Детали" - развернутся детали
echo    4. Проверьте обе темы (Dark/Light)
echo.
pause
