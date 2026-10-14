@echo off
title Columnas CREAR - sistema de prueba (no cerrar esta ventana)
cd /d "%~dp0.."
echo Bajando los ultimos cambios...
git checkout -q -- package-lock.json 2>nul
git pull -q --ff-only origin desarrollo
if exist node_modules (call npm install --no-audit --no-fund >nul 2>nul) else (call npm install --no-audit --no-fund)
REM Ventana aparte que trae los cambios nuevos cada 15 segundos
start "Columnas CREAR - actualizaciones" /min cmd /c "%~dp0actualizar.bat"
echo.
echo Sistema funcionando en http://localhost:5173
echo Para apagarlo, cerra esta ventana.
echo.
start "" http://localhost:5173
call npm run dev -- --port 5173 --strictPort --host
