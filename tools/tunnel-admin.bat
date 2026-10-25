@echo off
cd /d %~dp0
echo Starting Cloudflare tunnel for admin (http://localhost:5174)...
echo Copy the https://....trycloudflare.com URL printed below.
echo.
"%LOCALAPPDATA%\cloudflared\cloudflared.exe" tunnel --url http://localhost:5174 --no-autoupdate
pause
