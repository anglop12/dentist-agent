@echo off
title Parar Agente Dental (local)
echo [..] Buscando procesos en puertos 3000 (API) y 4000 (Panel)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 :4000" ^| findstr LISTENING') do (
  echo [..] Terminando PID %%p
  taskkill /F /PID %%p >nul 2>&1
)
echo [OK] API y Panel detenidos.
pause
