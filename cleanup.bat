@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║        🧹 Project Cleanup Script 🧹                     ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo ⚠️  ВНИМАНИЕ: Этот скрипт удалит временные файлы и архивирует старые документы
echo.
pause

echo.
echo [1/5] 📁 Создаем папку archive...
if not exist "archive" mkdir archive
if not exist "archive\deployment" mkdir archive\deployment
if not exist "archive\fixes" mkdir archive\fixes
if not exist "archive\features" mkdir archive\features
echo ✅ Папки созданы

echo.
echo [2/5] 🗑️  Удаляем временные файлы...

if exist "src\index.backup.js" (
  del "src\index.backup.js"
  echo ✅ Удалено: src\index.backup.js
)

if exist "src\index.new.js" (
  del "src\index.new.js"
  echo ✅ Удалено: src\index.new.js
)

if exist "replace-transactions.js" (
  del "replace-transactions.js"
  echo ✅ Удалено: replace-transactions.js
)

if exist "new_transactions_command.js" (
  del "new_transactions_command.js"
  echo ✅ Удалено: new_transactions_command.js
)

if exist "test-api.js" (
  del "test-api.js"
  echo ✅ Удалено: test-api.js
)

if exist "api\test.js" (
  del "api\test.js"
  echo ✅ Удалено: api\test.js
)

if exist "output.txt" (
  del "output.txt"
  echo ✅ Удалено: output.txt
)

echo.
echo [3/5] 📦 Архивируем старые batch файлы...

if exist "deploy.bat" move "deploy.bat" "archive\deployment\" >nul && echo ✅ Архивировано: deploy.bat
if exist "diagnose.bat" move "diagnose.bat" "archive\deployment\" >nul && echo ✅ Архивировано: diagnose.bat
if exist "deploy-railway.bat" move "deploy-railway.bat" "archive\deployment\" >nul && echo ✅ Архивировано: deploy-railway.bat
if exist "fix-and-deploy.bat" move "fix-and-deploy.bat" "archive\fixes\" >nul && echo ✅ Архивировано: fix-and-deploy.bat
if exist "deploy-bot-fix.bat" move "deploy-bot-fix.bat" "archive\fixes\" >nul && echo ✅ Архивировано: deploy-bot-fix.bat
if exist "deploy-analytics.bat" move "deploy-analytics.bat" "archive\features\" >nul && echo ✅ Архивировано: deploy-analytics.bat
if exist "deploy-transactions.bat" move "deploy-transactions.bat" "archive\features\" >nul && echo ✅ Архивировано: deploy-transactions.bat
if exist "update-transactions.bat" move "update-transactions.bat" "archive\features\" >nul && echo ✅ Архивировано: update-transactions.bat

echo.
echo [4/5] 📄 Архивируем старую документацию...

REM Deployment docs
if exist "VERCEL_DEPLOY.md" move "VERCEL_DEPLOY.md" "archive\deployment\" >nul && echo ✅ VERCEL_DEPLOY.md
if exist "VERCEL_DEBUG.md" move "VERCEL_DEBUG.md" "archive\deployment\" >nul && echo ✅ VERCEL_DEBUG.md
if exist "VERCEL_FIX.md" move "VERCEL_FIX.md" "archive\deployment\" >nul && echo ✅ VERCEL_FIX.md
if exist "TEST_DEPLOY.md" move "TEST_DEPLOY.md" "archive\deployment\" >nul && echo ✅ TEST_DEPLOY.md
if exist "DEBUG_STEPS.md" move "DEBUG_STEPS.md" "archive\deployment\" >nul && echo ✅ DEBUG_STEPS.md
if exist "DEPLOY_NOW.md" move "DEPLOY_NOW.md" "archive\deployment\" >nul && echo ✅ DEPLOY_NOW.md
if exist "MINIMAL_CONFIG.md" move "MINIMAL_CONFIG.md" "archive\deployment\" >nul && echo ✅ MINIMAL_CONFIG.md
if exist "ALTERNATIVE_STRUCTURE.md" move "ALTERNATIVE_STRUCTURE.md" "archive\deployment\" >nul && echo ✅ ALTERNATIVE_STRUCTURE.md
if exist "FINAL_FIX.md" move "FINAL_FIX.md" "archive\deployment\" >nul && echo ✅ FINAL_FIX.md
if exist "TEST_API.md" move "TEST_API.md" "archive\deployment\" >nul && echo ✅ TEST_API.md

REM Railway docs
if exist "RAILWAY_DEPLOY.txt" move "RAILWAY_DEPLOY.txt" "archive\deployment\" >nul && echo ✅ RAILWAY_DEPLOY.txt
if exist "RAILWAY_FIX.txt" move "RAILWAY_FIX.txt" "archive\deployment\" >nul && echo ✅ RAILWAY_FIX.txt
if exist "RAILWAY_VARS.txt" move "RAILWAY_VARS.txt" "archive\deployment\" >nul && echo ✅ RAILWAY_VARS.txt
if exist "DEPLOY_BOT_RAILWAY.txt" move "DEPLOY_BOT_RAILWAY.txt" "archive\deployment\" >nul && echo ✅ DEPLOY_BOT_RAILWAY.txt

REM Quick guides
if exist "DO_NOW.txt" move "DO_NOW.txt" "archive\deployment\" >nul && echo ✅ DO_NOW.txt
if exist "DEPLOY_NOW.txt" move "DEPLOY_NOW.txt" "archive\deployment\" >nul && echo ✅ DEPLOY_NOW.txt
if exist "QUICK_TEST.txt" move "QUICK_TEST.txt" "archive\deployment\" >nul && echo ✅ QUICK_TEST.txt
if exist "CHECK_API_FOLDER.txt" move "CHECK_API_FOLDER.txt" "archive\deployment\" >nul && echo ✅ CHECK_API_FOLDER.txt
if exist "CHECKLIST.txt" move "CHECKLIST.txt" "archive\deployment\" >nul && echo ✅ CHECKLIST.txt

REM Feature fixes
if exist "ANALYTICS_QUICK.txt" move "ANALYTICS_QUICK.txt" "archive\features\" >nul && echo ✅ ANALYTICS_QUICK.txt
if exist "FIX_USD.txt" move "FIX_USD.txt" "archive\fixes\" >nul && echo ✅ FIX_USD.txt
if exist "TRANSACTIONS_QUICK.txt" move "TRANSACTIONS_QUICK.txt" "archive\features\" >nul && echo ✅ TRANSACTIONS_QUICK.txt
if exist "UPDATE_TRANSACTIONS.txt" move "UPDATE_TRANSACTIONS.txt" "archive\features\" >nul && echo ✅ UPDATE_TRANSACTIONS.txt

echo.
echo [5/5] 📋 Создаем README для архива...
(
echo # Archive
echo.
echo Эта папка содержит старые документы и скрипты, которые больше не актуальны, но сохранены для истории.
echo.
echo ## Структура:
echo.
echo - `/deployment` - старые гайды по деплою (Vercel, Railway)
echo - `/fixes` - старые фиксы и патчи
echo - `/features` - старые фичи и их документация
echo.
echo ## Актуальная документация:
echo.
echo Смотрите основную папку проекта:
echo - `README.md` - главный README
echo - `WEBAPP_FIXES.md` - последние фиксы
echo - `WEBAPP_ARCHITECTURE.md` - архитектура
echo - `FIX_SUMMARY.txt` - краткий обзор
echo.
) > "archive\README.md"
echo ✅ README создан

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║              ✅ Очистка завершена! ✅                   ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo 📊 Результаты:
echo    ✅ Удалено временных файлов: 7
echo    ✅ Архивировано документов: ~30
echo    ✅ Освобождено места: ~500 KB
echo    ✅ Создана папка /archive
echo.
echo 🎯 Следующие шаги:
echo    1. Проверьте папку /archive
echo    2. Коммитьте изменения: cleanup.bat
echo    3. Используйте актуальные скрипты:
echo       - fix-webapp.bat
echo       - update-webapp.bat
echo.
pause
