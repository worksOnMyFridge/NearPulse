@echo off
chcp 65001 >nul
echo ========================================
echo 🛡️ Deploy: Стабильная версия
echo ========================================
echo.

echo 📦 Добавляем файлы в Git...
git add webapp/src/components/OverviewScreen.jsx
git add webapp/src/components/GalleryScreenStable.jsx
git add webapp/src/App.jsx
git add src/api.js
echo ✅ Файлы добавлены
echo.

echo 📝 Создаём коммит...
git commit -m "fix: stable version with manual NFT loading" -m "Changes:" -m "- Removed auto-loading NFT from OverviewScreen" -m "- Created GalleryScreenStable with manual load button" -m "- NFT API always returns 200 OK (fail-safe)" -m "- Isolated errors - NFT failures do not crash app" -m "- Balance and analytics load independently"

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
echo ✅ Деплой завершён успешно!
echo ========================================
echo.
echo 📍 Следующие шаги:
echo 1. Railway деплоит через 2-3 минуты
echo 2. Vercel деплоит через 1-2 минуты
echo 3. Откройте приложение
echo 4. Проверьте баланс (должен загрузиться сразу)
echo 5. Галерея будет с кнопкой ручной загрузки
echo.
echo 💤 Спокойной ночи!
echo.
pause
