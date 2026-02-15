@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo 💰 ИСПРАВЛЕНИЕ: Отображение USD цен
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/3] Добавление файла с исправлением...
git add src/services/nearService.js
echo ✅ nearService.js добавлен

echo.
echo [2/3] Коммит...
git commit -m "fix: Add fallback sources for NEAR price (Ref Finance, Nearblocks)"

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
echo После деплоя проверьте в Telegram:
echo   /balance leninjiv23.tg
echo.
echo Должны появиться USD значения рядом с NEAR! 💵
echo.
pause
