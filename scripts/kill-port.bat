@echo off
set "PORT=%~1"
if "%PORT%"=="" exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kill-port.ps1" -Port %PORT%
exit /b 0
