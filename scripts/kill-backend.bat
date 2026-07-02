@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kill-backend.ps1" -Port %1
exit /b 0
