@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo No se encontro npm. Instala Node.js e intentalo de nuevo.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Fallo npm install.
    pause
    exit /b 1
  )
)

echo Arrancando Mana Binder...
call npm run electron:dev
if errorlevel 1 (
  echo.
  echo La app se cerro con error.
  pause
)
