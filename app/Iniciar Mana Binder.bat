@echo off
title Mana Binder
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo No se encontro Node.js/npm. Instala Node desde https://nodejs.org
  pause
  exit /b 1
)

echo Iniciando Mana Binder...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar-ManaBinder.ps1"
set ERR=%ERRORLEVEL%
if not "%ERR%"=="0" (
  echo.
  echo Hubo un error ^(codigo %ERR%^).
  pause
)
exit /b %ERR%
