@echo off
cd /d "%~dp0"
set "BUNMINE_CHROME_PROFILE=%LOCALAPPDATA%\Bunmine\ChromeProfile"
start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --user-data-dir="%BUNMINE_CHROME_PROFILE%" --no-first-run --no-default-browser-check --app="http://127.0.0.1:5000/library-page"
py server.py
if errorlevel 1 pause
