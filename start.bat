@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
echo Starting Homework Planner...
echo.
echo [Note] For PostgreSQL: docker compose up -d
echo        Local dev uses SQLite if DATABASE_URL is set in .env
echo.

call "%~dp0scripts\kill-port.bat" 5173
call "%~dp0scripts\kill-backend.bat" 8002
call "%~dp0scripts\open-lan-ports.bat"

set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "IP=%%a"
  set "IP=!IP: =!"
  echo !IP! | findstr /r "^192\.168\." >nul && set "LAN_IP=!IP!" && goto :found_ip
  echo !IP! | findstr /r "^10\." >nul && set "LAN_IP=!IP!" && goto :found_ip
  if not defined LAN_IP set "LAN_IP=!IP!"
)
:found_ip

start "Backend" cmd /k "cd /d %~dp0backend && pip install -r requirements.txt -q && uvicorn app.main:app --host 127.0.0.1 --port 8002"
call "%~dp0scripts\wait-backend.bat" 8002
if errorlevel 1 (
  echo.
  echo Startup aborted: backend not ready. Fix the Backend window, then rerun start.bat.
  pause
  exit /b 1
)
start "Frontend" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo Backend:  http://localhost:8002
echo Frontend: http://localhost:5173
echo Login:    http://localhost:5173/login
echo Admin:    http://localhost:5173/admin
if defined LAN_IP (
  echo.
  echo LAN access ^(other devices on the same network^):
  echo Frontend: http://!LAN_IP!:5173
  echo Login:    http://!LAN_IP!:5173/login
  echo Admin:    http://!LAN_IP!:5173/admin
)
echo.
pause
