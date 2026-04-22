@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo 🔧 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ - API URL
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/3] Добавление исправленного файла...
git add webapp/src/services/api.js webapp/.env.example
echo ✅ Файлы добавлены

echo.
echo [2/3] Коммит...
git commit -m "fix: Use VITE_API_URL environment variable in production"

echo.
echo [3/3] Пуш в GitHub...
git push origin master

echo.
echo ═══════════════════════════════════════════════════════
echo ✅ ОТПРАВЛЕНО!
echo ═══════════════════════════════════════════════════════
echo.
echo Vercel автоматически начнёт сборку (2-3 минуты)
echo.
echo После деплоя откройте:
echo   https://near-pulse.vercel.app/
echo.
echo Должен показать реальный баланс NEAR и HOT! 🎉
echo.
pause
