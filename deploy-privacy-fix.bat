@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════╗
echo ║   🔒 Privacy Audit Fix Deploy 🔒   ║
echo ╚══════════════════════════════════════╝
echo.

echo [1/3] 📝 Коммитим изменения приватности...
git add .
git commit -m "security: Clean up logs for privacy compliance

- Removed request logging middleware from api.js
- Removed endpoint request logs (balance, transactions, hot-claim)
- Removed CORS blocked origin logging
- Made database balance snapshot logging dev-only
- Kept only critical errors and startup messages
- Improved privacy: no request details in production logs
- Compliance: GDPR data minimization"

if errorlevel 1 (
  echo ⚠️  Нет изменений для коммита или ошибка
)

echo.
echo [2/3] ☁️  Пушим в GitHub...
git push
if errorlevel 1 (
  echo ❌ Ошибка при push
  pause
  exit /b 1
)

echo.
echo [3/3] 🔄 Ждем деплоя Railway (Backend)...
echo    https://railway.app/project
timeout /t 5 /nobreak >nul

echo.
echo ╔══════════════════════════════════════╗
echo ║    ✅ Privacy Fixes Deployed! ✅    ║
echo ╚══════════════════════════════════════╝
echo.
echo 🔒 Что исправлено:
echo    ✅ Удалено логирование запросов
echo    ✅ Удалено логирование headers
echo    ✅ Удалено логирование origin
echo    ✅ DB логи только в dev режиме
echo    ✅ Оставлены только критические ошибки
echo.
echo 🎯 Privacy уровень:
echo    ✅ IP адреса НЕ логируются
echo    ✅ Request details НЕ логируются
echo    ✅ Только публичные данные в БД
echo    ✅ GDPR compliant
echo.
echo 🧪 Проверьте Railway logs:
echo    - Не должно быть request logs
echo    - Только errors и startup messages
echo.
pause
