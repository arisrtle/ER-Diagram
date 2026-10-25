@echo off
cd /d %~dp0
call npm run build
echo.
echo Output: dist
pause
