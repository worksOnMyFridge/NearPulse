@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo 📜 ОБНОВЛЕНИЕ КОМАНДЫ /transactions
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/5] Установка dayjs...
call npm install dayjs
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка установки dayjs
    pause
    exit /b 1
)
echo ✅ dayjs установлен

echo.
echo [2/5] Создание backup старого файла...
copy src\index.js src\index.backup.js >nul
echo ✅ Backup создан: src\index.backup.js

echo.
echo [3/5] Замена на новую версию...
copy /Y src\index.new.js src\index.js >nul
echo ✅ Файл заменён

echo.
echo [4/5] Коммит изменений...
git add src/index.js package.json package-lock.json
git commit -m "feat: Redesign /transactions - 5 items, dayjs, emojis, USD prices"

echo.
echo [5/5] Пуш в GitHub...
git push origin master

echo.
echo ═══════════════════════════════════════════════════════
echo ✅ ГОТОВО!
echo ═══════════════════════════════════════════════════════
echo.
echo ЧТО НОВОГО:
echo   ✅ Только 5 последних транзакций
echo   ✅ Эмодзи: 📥 входящие, 📤 исходящие, 🔥 HOT claims
echo   ✅ Время: "15 минут назад" (dayjs)
echo   ✅ USD цены для NEAR
echo   ✅ Компактный формат (2-3 строки)
echo   ✅ Жирный шрифт для сумм
echo.
echo Railway автоматически обновит бота (1-2 минуты)
echo.
echo Проверьте в Telegram:
echo   /transactions leninjiv23.tg
echo.
echo Старая версия сохранена в: src\index.backup.js
echo.
pause
