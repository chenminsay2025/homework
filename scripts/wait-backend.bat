@echo off
setlocal EnableDelayedExpansion
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8002"
set "TRIES=0"
set "MAX=45"

:loop
set /a TRIES+=1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0wait-backend.ps1" -Port %PORT% >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Backend ready on port %PORT%.
  exit /b 0
)
if %TRIES% GEQ %MAX% (
  echo.
  echo [ERROR] Backend on port %PORT% did not become ready in %MAX% seconds.
  echo         Check the "Backend" window for errors.
  echo         Try: scripts\kill-backend.bat %PORT%  then run start.bat again.
  echo         Or open http://localhost:%PORT%/api/health — should show "day-items".
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto loop
