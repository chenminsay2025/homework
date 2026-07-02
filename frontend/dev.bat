@echo off
call "%~dp0..\scripts\kill-port.bat" 5173
call "%~dp0..\scripts\open-lan-ports.bat"
timeout /t 1 /nobreak >nul
cd /d "%~dp0"
npm run dev
