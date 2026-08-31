@echo off
title Sara - Modo Maestro
cd /d "C:\Users\Marito\sara-master"

REM Verificar que el proxy de Hermes esté corriendo
curl -s -o nul http://127.0.0.1:8645/v1/models
if errorlevel 1 (
    echo [Sara] El proxy no esta corriendo. Iniciandolo...
    start /min "" cmd /c "hermes proxy start"
    timeout /t 6 /nobreak >nul
)

echo [Sara] Abriendo modo maestro... (Ctrl+Alt+S para salir)
npx electron .
