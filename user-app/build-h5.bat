@echo off
cd /d %~dp0
echo Building H5...
call npm run build:h5
echo.
echo Output: dist\build\h5
pause
