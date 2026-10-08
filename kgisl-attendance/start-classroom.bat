@echo off
rem Double-click to start the classroom BLE beacon helper and open the attendance site.
rem Use "start-classroom.bat local" to open http://localhost:5173 instead of the hosted site.
title KGiSL Classroom Start
if /I "%~1"=="local" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-classroom.ps1" -Site local
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-classroom.ps1"
)
echo.
timeout /t 5 >nul
