@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo 🔍 ДИАГНОСТИКА ПРОБЛЕМЫ
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [ПРОВЕРКА 1] Папка api/ существует локально?
if exist "api\index.js" (
    echo ✅ api\index.js найден
) else (
    echo ❌ api\index.js НЕ найден!
)

if exist "api\test.js" (
    echo ✅ api\test.js найден
) else (
    echo ❌ api\test.js НЕ найден!
)

echo.
echo [ПРОВЕРКА 2] Папка api/ в Git репозитории?
echo Выполняю: git ls-tree HEAD api/
git ls-tree HEAD api/
echo.

echo [ПРОВЕРКА 3] Последний коммит:
git log -1 --oneline
echo.

echo [ПРОВЕРКА 4] Ветка и remote:
git branch
git remote -v
echo.

echo [ПРОВЕРКА 5] Содержимое vercel.json:
type vercel.json
echo.

echo ═══════════════════════════════════════════════════════
echo 📋 ДИАГНОСТИКА ЗАВЕРШЕНА
echo ═══════════════════════════════════════════════════════
echo.
echo Скопируйте ВСЁ что выше и покажите мне!
echo.
pause
