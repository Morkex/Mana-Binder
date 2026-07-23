# Arranque robusto de Mana Binder (Vite + Electron)
$ErrorActionPreference = 'Stop'
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppDir

function Get-NpmCmd {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $fallback = Join-Path $env:ProgramFiles 'nodejs\npm.cmd'
  if (Test-Path $fallback) { return $fallback }
  return $null
}

function Test-ViteUp {
  try {
    $null = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2
    return $true
  } catch {
    return $false
  }
}

$npmCmd = Get-NpmCmd
if (-not $npmCmd) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show(
    'No se encontro npm.cmd. Instala Node.js desde https://nodejs.org',
    'Mana Binder'
  ) | Out-Null
  exit 1
}

if (-not (Test-Path (Join-Path $AppDir 'node_modules\electron\dist\electron.exe'))) {
  Write-Host 'Instalando dependencias...'
  & $npmCmd install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$startedVite = $false
$vite = $null

if (-not (Test-ViteUp)) {
  Write-Host 'Arrancando servidor...'
  # IMPORTANTE: usar npm.cmd, nunca "npm" (resuelve a npm.ps1 y se abre en Notepad)
  $vite = Start-Process -FilePath $npmCmd -ArgumentList 'run', 'dev' `
    -WorkingDirectory $AppDir -PassThru -WindowStyle Minimized
  $startedVite = $true

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-ViteUp) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show('Vite no respondio a tiempo en el puerto 5173.', 'Mana Binder') | Out-Null
    if ($vite -and -not $vite.HasExited) { Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue }
    exit 1
  }
}

Write-Host 'Abriendo Mana Binder...'
$electronExe = Join-Path $AppDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electronExe)) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show("No se encontro Electron:`n$electronExe", 'Mana Binder') | Out-Null
  exit 1
}

$electron = Start-Process -FilePath $electronExe -ArgumentList '.' -WorkingDirectory $AppDir -PassThru
Wait-Process -Id $electron.Id

if ($startedVite -and $vite -and -not $vite.HasExited) {
  Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
