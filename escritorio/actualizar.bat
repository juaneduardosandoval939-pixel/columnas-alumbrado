@echo off
title Columnas CREAR - actualizaciones automaticas
cd /d "%~dp0.."
echo Buscando cambios nuevos cada 15 segundos. Podes minimizar esta ventana.

:buscar
git fetch -q origin desarrollo 2>nul
git diff --quiet HEAD FETCH_HEAD 2>nul
if errorlevel 1 goto actualizar
timeout /t 15 /nobreak >nul
goto buscar

:actualizar
echo.
echo [%date% %time:~0,5%] Llegaron cambios:
git log --oneline HEAD..FETCH_HEAD
git diff --quiet HEAD FETCH_HEAD -- package.json
if errorlevel 1 goto conDependencias
git checkout -q -- package-lock.json 2>nul
git pull -q --ff-only origin desarrollo
echo La pagina se actualiza sola en el navegador.
timeout /t 15 /nobreak >nul
goto buscar

:conDependencias
git checkout -q -- package-lock.json 2>nul
git pull -q --ff-only origin desarrollo
call npm install --no-audit --no-fund
echo.
echo Este cambio agrega componentes nuevos: cerra la ventana del sistema y abri de nuevo "Abrir Columnas CREAR".
timeout /t 15 /nobreak >nul
goto buscar
