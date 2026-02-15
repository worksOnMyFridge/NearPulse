@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════════════════════
echo 🚀 ПРОВЕРКА И ДЕПЛОЙ НА VERCEL
echo ═══════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/4] Проверка папки api/...
git ls-tree HEAD api/ >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Папка api/ НЕ в Git! Добавляю...
    git add api/
) else (
    echo ✅ Папка api/ уже в Git
)

echo.
echo [2/4] Добавление всех изменений...
git add -A

echo.
echo [3/4] Коммит...
git commit -m "fix: Minimal Vercel config with auto-detected api functions"

echo.
echo [4/4] Пуш в GitHub...
git push origin master

echo.
echo ═══════════════════════════════════════════════════════
echo ✅ ГОТОВО! Vercel начнёт автоматический деплой.
echo ═══════════════════════════════════════════════════════
echo.
echo Подождите 2-3 минуты и проверьте:
echo   1. https://near-pulse.vercel.app/api/test
echo   2. https://near-pulse.vercel.app/api/health
echo   3. https://near-pulse.vercel.app/
echo.
pause
