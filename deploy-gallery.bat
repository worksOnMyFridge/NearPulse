@echo off
chcp 65001 >nul
cls

echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║    🎨 Deploy - Галерея NFT с Multi-Select                 ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo 📝 Новая функция: Продвинутая галерея NFT
echo.
echo ✅ Папки-коллекции (Все / HOT Craft / Спам)
echo ✅ Multi-select режим с чекбоксами
echo ✅ Bottom Toolbar с массовыми действиями
echo ✅ Glassmorphism дизайн и анимации
echo ✅ localStorage для хранения спама
echo ✅ API endpoints для управления NFT
echo.

git status >nul 2>&1
if errorlevel 1 (
    echo ❌ Не Git репозиторий!
    pause
    exit /b 1
)

echo ⏳ Добавляю файлы галереи...
git add webapp/src/components/GalleryScreen.jsx
git add webapp/src/services/api.js
git add webapp/src/App.jsx
git add webapp/src/components/Header.jsx
git add webapp/src/index.css
git add src/api.js
git add GALLERY_FEATURE.md

echo ⏳ Создаю коммит...
git commit -m "feat: добавлена продвинутая галерея NFT" -m "🎨 Галерея NFT с Multi-Select:" -m "- Структура с папками-коллекциями (Все / HOT Craft 🔥 / Спам)" -m "- Автоматическая группировка NFT по коллекциям" -m "- Режим multi-select с чекбоксами в Glassmorphism стиле" -m "- Bottom Toolbar с массовыми действиями (В спам / Восстановить / Удалить)" -m "- Мгновенное обновление UI при перемещении NFT" -m "- localStorage для хранения состояния спама" -m "- Плавные анимации slide-up для toolbar" -m "" -m "🔧 API endpoints:" -m "- POST /api/nfts/spam - пометить NFT как спам" -m "- DELETE /api/nfts/spam - восстановить из спама" -m "" -m "🎨 Дизайн:" -m "- Glassmorphism стили для всех элементов" -m "- Hover и scale эффекты" -m "- Анимация появления Bottom Toolbar" -m "- Синяя рамка для выбранных NFT" -m "- HOT бейджи для застейканных NFT"

if errorlevel 1 (
    echo ❌ Ошибка коммита! Возможно нет изменений.
    pause
    exit /b 1
)

echo ⏳ Отправляю на GitHub...
git push

if errorlevel 1 (
    echo ❌ Ошибка push!
    pause
    exit /b 1
)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║         ✅ Галерея NFT успешно задеплоена!                ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 🎉 Railway и Vercel автоматически обновятся через 1-2 минуты
echo.
echo 📱 Проверьте в Telegram боте:
echo    - Откройте вкладку "🎨 Галерея"
echo    - Попробуйте Multi-Select режим
echo    - Переместите NFT в спам
echo.
echo 📖 Документация: GALLERY_FEATURE.md
echo.

pause
