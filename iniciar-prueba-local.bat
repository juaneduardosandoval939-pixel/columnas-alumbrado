@echo off
REM ── Columnas de Alumbrado - CREAR: version de prueba en esta PC ──
REM Requiere Node.js instalado (https://nodejs.org, version LTS).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Falta instalar Node.js. Descargalo de https://nodejs.org ^(boton LTS^), instalalo y volve a abrir este archivo.
  echo.
  pause
  exit /b
)
if not exist node_modules (
  echo Instalando por unica vez... puede tardar un par de minutos.
  call npm install
)
echo.
echo Abriendo el sistema en http://localhost:5173  (para cerrarlo, cerra esta ventana)
start "" http://localhost:5173
call npm run dev -- --port 5173 --host
