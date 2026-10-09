@echo off
cd /d "%~dp0"
start "Bunmine server" /b py server.py
powershell -NoProfile -Command "$ready=$false; 1..300 | ForEach-Object { if (-not $ready) { try { $response=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5000/library/db/status' -TimeoutSec 1; $ready=$response.StatusCode -eq 200 } catch {}; if (-not $ready) { Start-Sleep -Milliseconds 200 } } }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
  echo Bunmine server did not start.
  pause
  exit /b 1
)
start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "http://127.0.0.1:5000/library-page"
