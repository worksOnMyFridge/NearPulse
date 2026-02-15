@echo off
chcp 65001 >nul
echo ========================================
echo 🔧 Исправление npm конфигурации
echo ========================================
echo.

echo 📦 Обновляем конфигурацию Railway...
git add railway.json
git add nixpacks.toml
echo ✅ Файлы обновлены
echo.

echo 📝 Создаём коммит...
git commit -m "fix: use npm install instead of npm ci" -m "Railway fails because package-lock.json is missing" -m "Changed nixpacks.toml to use npm install"

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
echo 📍 Теперь будет использоваться npm install вместо npm ci
echo.
pause
