# One-click classroom start for the KGiSL BLE beacon.
#   - makes sure the smart-board helper is configured (secret key, auto-detected ESP32 port)
#   - starts the helper if it is not already running
#   - opens the attendance site already paired with the helper (no key typing)
#
# Usage:  .\start-classroom.ps1            -> opens the production site
#         .\start-classroom.ps1 -Site local -> opens http://localhost:5173
param(
  [ValidateSet('prod', 'local')][string]$Site = 'prod',
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$helperDir = Join-Path $root 'smartboard-helper'
$envFile = Join-Path $helperDir '.env'
$helperPort = 43821
$prodOrigin = 'https://kgisl-attendance-1.onrender.com'
$localOrigin = 'http://localhost:5173'

function Write-Step($text) { Write-Host "  $text" -ForegroundColor Cyan }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required. Install it from https://nodejs.org and run this again.' -ForegroundColor Red
  exit 1
}

# ---- 1. helper configuration ---------------------------------------------------------------
if (-not (Test-Path (Join-Path $helperDir 'node_modules'))) {
  Write-Step 'Installing helper dependencies (first run only)...'
  Push-Location $helperDir; npm install --no-audit --no-fund | Out-Null; Pop-Location
}

$lines = @()
if (Test-Path $envFile) { $lines = @(Get-Content $envFile) }
function Get-EnvValue($name) {
  $match = $lines | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if ($match) { return ($match -replace "^\s*$name\s*=\s*", '').Trim().Trim('"') }
  return $null
}
function Set-EnvValue($name, $value) {
  $script:lines = @($script:lines | Where-Object { $_ -notmatch "^\s*$name\s*=" }) + "$name=$value"
}

$key = Get-EnvValue 'HELPER_API_KEY'
if (-not $key -or $key.Length -lt 32 -or $key -match 'replace-with') {
  $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $key = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
  Set-EnvValue 'HELPER_API_KEY' $key
  Write-Step 'Generated a new helper key.'
}
Set-EnvValue 'HELPER_TRANSPORT' 'serial'
if (-not (Get-EnvValue 'ESP32_SERIAL_PORT')) { Set-EnvValue 'ESP32_SERIAL_PORT' 'auto' }
if (-not (Get-EnvValue 'HELPER_PORT')) { Set-EnvValue 'HELPER_PORT' "$helperPort" }

$origins = @(((Get-EnvValue 'HELPER_ALLOWED_ORIGIN') -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($origin in @($prodOrigin, $localOrigin)) { if ($origins -notcontains $origin) { $origins += $origin } }
Set-EnvValue 'HELPER_ALLOWED_ORIGIN' ($origins -join ',')
Set-Content -Path $envFile -Value $lines -Encoding ascii

# ---- 2. start the helper -------------------------------------------------------------------
$headers = @{ 'x-helper-key' = $key }
function Get-Health {
  try { return Invoke-RestMethod "http://127.0.0.1:$helperPort/health" -Headers $headers -TimeoutSec 3 } catch { return $null }
}

$health = Get-Health
if (-not $health) {
  if (Get-NetTCPConnection -LocalPort $helperPort -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "Port $helperPort is used by another program or an older helper with a different key. Close it and run again." -ForegroundColor Red
    exit 1
  }
  Write-Step 'Starting the classroom helper...'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'title KGiSL Classroom Helper && node src/index.js' -WorkingDirectory $helperDir -WindowStyle Minimized
  for ($i = 0; $i -lt 30 -and -not $health; $i++) { Start-Sleep -Milliseconds 500; $health = Get-Health }
}
if (-not $health) {
  Write-Host 'The helper did not start. Open smartboard-helper and run "npm start" to see the error.' -ForegroundColor Red
  exit 1
}

# Ask the helper to connect to the ESP32 now (retries while the board finishes booting).
$connected = [bool]$health.transport.connected
$port = $health.transport.port
for ($i = 0; $i -lt 4 -and -not $connected; $i++) {
  try {
    $result = Invoke-RestMethod -Method Post "http://127.0.0.1:$helperPort/api/v1/connect" -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 20
    $connected = [bool]$result.data.transport.connected
    $port = $result.data.transport.port
  } catch { Start-Sleep -Seconds 2 }
}
if ($connected) {
  Write-Host "  Helper running. ESP32 beacon connected on $port." -ForegroundColor Green
} else {
  Write-Host '  Helper running, but no ESP32 found. Plug it into USB - the website start button connects it.' -ForegroundColor Yellow
}

# ---- 3. open the site, paired with the helper ----------------------------------------------
if (-not $NoBrowser) {
  $base = if ($Site -eq 'local') { $localOrigin } else { $prodOrigin }
  Write-Step "Opening $base ..."
  Start-Process "$base/#helperKey=$key"
}
