@echo off
chcp 65001 >nul
cls

echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║         🛑 NEAR Analytics Bot - Stop All Instances        ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo 🔍 Поиск запущенных Node.js процессов...
echo.

:: Показываем все Node.js процессы
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find "node.exe" >nul
if errorlevel 1 (
    echo ✅ Node.js процессы не найдены
    echo.
    pause
    exit /b 0
)

echo 📋 Найдены Node.js процессы:
echo ════════════════════════════════════════════════════════════
tasklist /FI "IMAGENAME eq node.exe"
echo ════════════════════════════════════════════════════════════
echo.

set /p confirm="Остановить ВСЕ Node.js процессы? (y/n): "
if /i not "%confirm%"=="y" (
    echo.
    echo ❌ Отменено
    pause
    exit /b 0
)

echo.
echo 🛑 Останавливаем все Node.js процессы...

taskkill /F /IM node.exe 2>nul
if errorlevel 1 (
    echo ⚠️  Не удалось остановить некоторые процессы
    echo    Возможно требуются права администратора
    echo.
    echo Попробуйте:
    echo 1. Закрыть окна терминалов с Node.js вручную
    echo 2. Запустить этот файл от имени администратора
) else (
    echo ✅ Все Node.js процессы остановлены
)

echo.
echo ════════════════════════════════════════════════════════════
echo.
echo 💡 Теперь можно запустить бота заново:
echo    npm run dev
echo    или
echo    start.bat
echo.

pause
