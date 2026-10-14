@echo off
setlocal
title Instalar Columnas CREAR en el escritorio
echo ============================================================
echo   Columnas de Alumbrado - CREAR : instalacion en esta PC
echo ============================================================
echo.

REM ---- 1. Git (para bajar el codigo y recibir las actualizaciones) ----
where git >nul 2>nul
if errorlevel 1 (
  echo Instalando Git... ^(acepta los permisos que pida Windows^)
  winget install --id Git.Git -e --silent --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\Git\cmd"
)
where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se pudo instalar Git automaticamente.
  echo Instalalo a mano desde https://git-scm.com/download/win y volve a abrir este archivo.
  pause
  exit /b 1
)

REM ---- 2. Node.js (para hacer funcionar el sistema) ----
where node >nul 2>nul
if errorlevel 1 (
  echo Instalando Node.js... ^(acepta los permisos que pida Windows^)
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\nodejs"
)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se pudo instalar Node.js automaticamente.
  echo Instalalo a mano desde https://nodejs.org ^(boton LTS^) y volve a abrir este archivo.
  pause
  exit /b 1
)

REM ---- 3. Carpeta en el escritorio (sirve aunque el escritorio este en OneDrive) ----
for /f "usebackq delims=" %%d in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "ESCRITORIO=%%d"
set "DEST=%ESCRITORIO%\columnas-alumbrado"
set "REPO=https://github.com/juaneduardosandoval939-pixel/columnas-alumbrado.git"

if exist "%DEST%\.git" (
  echo La carpeta ya existe: actualizando...
  cd /d "%DEST%"
  git checkout -q desarrollo
  git pull -q --ff-only origin desarrollo
) else (
  echo Bajando el codigo desde GitHub...
  echo ^(si se abre una ventana de GitHub, inicia sesion con tu cuenta y autoriza^)
  git clone -b desarrollo "%REPO%" "%DEST%"
  if errorlevel 1 (
    echo.
    echo No se pudo bajar el codigo. Revisa la conexion e inicia sesion en GitHub cuando lo pida.
    pause
    exit /b 1
  )
  cd /d "%DEST%"
)

echo Instalando lo que necesita el sistema ^(la primera vez tarda 1 o 2 minutos^)...
call npm install --no-audit --no-fund

REM ---- 4. Acceso directo en el escritorio ----
(
  echo @echo off
  echo call "%DEST%\escritorio\iniciar.bat"
) > "%ESCRITORIO%\Abrir Columnas CREAR.bat"

echo.
echo ============================================================
echo   Listo. En el escritorio quedo "Abrir Columnas CREAR".
echo   Ahora se abre el sistema...
echo ============================================================
call "%DEST%\escritorio\iniciar.bat"
