@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo 🚂 RAILWAY DEPLOYMENT FIX
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/3] Добавление файлов...
git add Procfile package.json
echo ✅ Procfile и package.json добавлены

echo.
echo [2/3] Коммит...
git commit -m "fix: Add Procfile for Railway to start API instead of bot"

echo.
echo [3/3] Пуш в GitHub...
git push origin master

echo.
echo ═══════════════════════════════════════════════════════
echo ✅ ФАЙЛЫ ОТПРАВЛЕНЫ!
echo ═══════════════════════════════════════════════════════
echo.
echo ТЕПЕРЬ В RAILWAY:
echo.
echo 1. Откройте Railway Dashboard
echo 2. Проект NearPulse → Settings
echo 3. Deploy → Custom Start Command
echo 4. Введите: node src/api.js
echo 5. Нажмите Save
echo 6. Вкладка Deployments → Redeploy
echo.
echo ИЛИ Railway автоматически увидит Procfile и перезапустится!
echo.
pause
