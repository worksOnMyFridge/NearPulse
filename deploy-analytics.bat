@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo 📊 ДОБАВЛЕНИЕ АНАЛИТИКИ
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/3] Добавление файлов...
git add src/index.js src/config/database.js
echo ✅ Файлы добавлены

echo.
echo [2/3] Коммит...
git commit -m "feat: Add /analytics command with 24h changes, distribution, and top tokens"

echo.
echo [3/3] Пуш в GitHub...
git push origin master

echo.
echo ═══════════════════════════════════════════════════════
echo ✅ ОТПРАВЛЕНО!
echo ═══════════════════════════════════════════════════════
echo.
echo Railway автоматически обновит бота (1-2 минуты)
echo.
echo ЧТО НОВОГО:
echo   📊 /analytics - Аналитика портфеля
echo   📈 Изменение за 24 часа
echo   💼 Распределение активов
echo   🏆 Топ токенов
echo   📊 Активность
echo.
echo После деплоя проверьте в Telegram:
echo   /analytics leninjiv23.tg
echo.
pause
