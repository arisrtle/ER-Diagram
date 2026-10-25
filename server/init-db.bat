@echo off
cd /d %~dp0
.venv\Scripts\python.exe init_db.py
pause
