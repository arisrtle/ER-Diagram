@echo off
start "wechat-checkin-mysql" "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --basedir="C:\Program Files\MySQL\MySQL Server 8.0" --datadir="%LOCALAPPDATA%\wechat-checkin-mysql" --port=3307 --bind-address=127.0.0.1 --console
