@echo off
cd /d %~dp0
echo ============================================
echo  Update student check-in QR code
echo ============================================
echo.
echo Paste the new H5 tunnel URL from the checkin-tunnel-h5 window.
echo Example: https://xxxx-xxxx-xxxx.trycloudflare.com/
echo.
set /p URL=URL: 
if "%URL%"=="" (
  echo No URL entered.
  pause
  exit /b 1
)
echo.
server\.venv\Scripts\python.exe tools\generate_qr.py "%URL%" "user-app\docs\qr-checkin.png"
echo.
echo QR updated: user-app\docs\qr-checkin.png
pause
