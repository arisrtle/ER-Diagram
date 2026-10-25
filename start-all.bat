@echo off
cd /d %~dp0
echo ============================================
echo  Start check-in demo services
echo ============================================
echo.

echo [1/5] MySQL 3307...
start "checkin-mysql" cmd /c "server\start-mysql.bat"
timeout /t 3 /nobreak >nul

echo [2/5] FastAPI 8000...
start "checkin-backend" cmd /c "server\run-backend.bat"
timeout /t 3 /nobreak >nul

echo [3/5] H5 user app 5173...
start "checkin-h5" cmd /c "user-app\start-h5.bat"

echo [4/5] Admin web 5174...
start "checkin-admin" cmd /c "admin-web\start-admin.bat"
timeout /t 3 /nobreak >nul

echo [5/5] Cloudflare tunnels...
start "checkin-tunnel-h5" cmd /c "tools\tunnel-h5.bat"
start "checkin-tunnel-admin" cmd /c "tools\tunnel-admin.bat"

echo.
echo All windows started.
echo Look at the two tunnel windows for the new https://....trycloudflare.com URLs.
echo.
echo Regenerate the H5 QR code with:
echo   server\.venv\Scripts\python.exe tools\generate_qr.py "https://NEW-H5-URL/" "user-app\docs\qr-checkin.png"
echo.
pause
