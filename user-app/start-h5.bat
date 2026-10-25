@echo off
cd /d %~dp0
echo Starting uni-app H5 dev server...
echo Open the URL shown below in your browser.
call npm run dev:h5
pause
