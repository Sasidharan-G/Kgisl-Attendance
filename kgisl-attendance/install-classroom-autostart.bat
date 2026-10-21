@echo off
rem Double-click ONCE on the classroom PC. The helper then starts by itself whenever the PC is switched on.
rem To undo: install-classroom-autostart.bat remove
title KGiSL Classroom Auto-start
if /I "%~1"=="remove" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smartboard-helper\install-autostart.ps1" -Remove
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smartboard-helper\install-autostart.ps1"
)
echo.
pause
