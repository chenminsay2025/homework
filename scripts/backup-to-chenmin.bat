@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-to-chenmin.ps1"
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo Backup failed with code %ERR%.
)
echo.
pause
exit /b %ERR%
