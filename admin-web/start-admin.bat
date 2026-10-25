@echo off
cd /d %~dp0
echo Starting admin web dev server...
echo Open http://localhost:5174
call npm run dev
pause
