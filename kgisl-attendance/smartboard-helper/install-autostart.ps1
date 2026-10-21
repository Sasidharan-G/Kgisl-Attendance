# Run ONCE on the classroom PC. After this the smart-board helper starts by itself every time the PC is
# switched on and someone signs in to Windows; there is nothing to open or click before a class.
#
#   .\install-autostart.ps1            install (and start the helper now)
#   .\install-autostart.ps1 -Remove    undo
#
# Afterwards the whole flow is: faculty signs in -> starts the session -> plugs the ESP32 into this PC.
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$helperDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $helperDir 'start-helper-hidden.vbs'
$shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'KGiSL Classroom Helper.lnk'
$port = 43821

if ($Remove) {
  if (Test-Path $shortcut) { Remove-Item $shortcut -Force; Write-Host 'Auto-start removed.' -ForegroundColor Green }
  else { Write-Host 'Auto-start was not installed.' }
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required. Install the LTS version from https://nodejs.org and run this again.' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $helperDir 'node_modules'))) {
  Write-Host 'Installing helper dependencies (first run only)...' -ForegroundColor Cyan
  Push-Location $helperDir
  try { npm install --no-audit --no-fund | Out-Null } finally { Pop-Location }
}

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$link.Arguments = "`"$launcher`""
$link.WorkingDirectory = $helperDir
$link.WindowStyle = 7
$link.Description = 'Starts the KGiSL classroom BLE helper'
$link.Save()
Write-Host "Auto-start installed: $shortcut" -ForegroundColor Green

# Start it right now as well, unless it is already listening.
$listening = $false
try {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.Connect('127.0.0.1', $port)
  $listening = $client.Connected
  $client.Close()
} catch { }

if ($listening) {
  Write-Host 'Helper is already running.' -ForegroundColor Green
} else {
  Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList "`"$launcher`""
  Start-Sleep -Seconds 2
  Write-Host 'Helper started. Plug the ESP32 into this PC any time: it is detected automatically.' -ForegroundColor Green
}
