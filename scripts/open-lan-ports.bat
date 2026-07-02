@echo off
setlocal

for %%P in (5173 8001) do (
  netsh advfirewall firewall show rule name="Homework Planner Port %%P" >nul 2>&1
  if errorlevel 1 (
    netsh advfirewall firewall add rule name="Homework Planner Port %%P" dir=in action=allow protocol=TCP localport=%%P >nul
    echo [Firewall] Opened inbound TCP port %%P
  )
)

exit /b 0
