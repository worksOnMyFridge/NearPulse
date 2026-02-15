@echo off
chcp 65001 >nul
echo ========================================
echo 🔧 Исправление Railway конфигурации
echo ========================================
echo.

echo 📦 Добавляем файлы конфигурации...
git add railway.json
git add nixpacks.toml
git add Procfile
git add package.json
echo ✅ Файлы добавлены
echo.

echo 📝 Создаём коммит...
git commit -m "fix: railway configuration for API server" -m "Add railway.json, nixpacks.toml, Procfile" -m "Change start script to use api.js instead of index.js" -m "This fixes node command not found error"

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
echo ✅ Исправление отправлено!
echo ========================================
echo.
echo 📍 Railway автоматически задеплоит через 2-3 минуты
echo 📍 Теперь будет запускаться src/api.js вместо src/index.js
echo.
echo 🔍 Проверьте логи Railway:
echo    https://railway.app
echo.
pause
