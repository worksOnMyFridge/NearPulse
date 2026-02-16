@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo Commit + Push: tokentxns
echo ========================================

git add -A
git status

git commit -m "feat: switch to tokentxns API for transactions" -m "- Token Transfers instead of txns (swaps: -10 NEAR +500 HOT)" -m "- Informative bot response instead of Contract call" -m "- Cache busting _=Date.now() for fresh data" -m "- Fallback to txns if tokentxns empty"

git push origin master

echo.
echo Done.
pause
