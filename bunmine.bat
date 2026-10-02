@echo off
cd /d "%~dp0"
start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "http://127.0.0.1:5000/library-page"
py server.py
if errorlevel 1 pause
