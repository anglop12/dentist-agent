@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Agente Dental - Local (Laragon)
cd /d "%~dp0"

echo ============================================================
echo   AGENTE ODONTOLOGICO IA  ^|  Arranque LOCAL (Laragon)
echo ============================================================
echo.

REM ---------- 0. Prerrequisitos ----------
where node >nul 2>&1 || (echo [ERROR] Node.js no esta instalado o no esta en PATH & goto :fail)
where pnpm >nul 2>&1 || (echo [ERROR] pnpm no esta instalado. Ejecuta: corepack enable & goto :fail)
for /f "delims=" %%v in ('node --version') do set NODEV=%%v
echo [OK] Node !NODEV! detectado

REM Puerto 3000 libre?
netstat -ano | findstr :3000 | findstr LISTENING >nul && (
  echo [ERROR] El puerto 3000 ya esta en uso ^(¿Docker esta arriba?^).
  echo         Ejecuta stop-docker.bat primero o usa otro APP_PORT en .env
  goto :fail
)

REM ---------- 1. .env ----------
if not exist ".env" (
  echo [..] Copiando .env.example a .env
  copy /y ".env.example" ".env" >nul
  REM Perfil por defecto sin dependencias externas:
  powershell -NoProfile -Command "(Get-Content '.env') -replace '^LLM_PROVIDER=.*','LLM_PROVIDER=mock' -replace '^WA_ENABLED=.*','WA_ENABLED=false' | Set-Content '.env'"
  echo [OK] .env creado (LLM_PROVIDER=mock, WhatsApp OFF)
) else (
  echo [OK] .env existente respetado
)

REM ---------- 2. Dependencias ----------
if not exist "node_modules" (
  echo [..] Instalando dependencias (puede tardar 1-2 min)...
  call pnpm install --frozen-lockfile || goto :fail
) else (
  echo [OK] node_modules presente
)

REM ---------- 3. Base de datos ----------
echo [..] Aplicando migraciones...
call pnpm migrate || goto :fail
echo [..] Cargando datos iniciales...
call pnpm db:seed || goto :fail

REM ---------- 4. Arrancar API en ventana propia ----------
echo [..] Levantando API en http://localhost:3000 ...
start "DENTIST-API (cierra esta ventana para parar)" cmd /k "cd /d %~dp0 && pnpm dev:api"

REM ---------- 5. Esperar healthz ----------
set TRIES=0
:waitloop
timeout /t 3 /nobreak >nul
set /a TRIES+=1
curl -s -o nul -m 2 http://localhost:3000/healthz
if errorlevel 1 (
  if !TRIES! lss 20 goto :waitloop
  echo [WARN] La API no respondio a los 60s. Revisa la ventana DENTIST-API.
  goto :summary
)
echo [OK] API saludable

REM ---------- 6. Panel visual ----------
echo [..] Levantando panel en http://localhost:4000 ...
start "DENTIST-PANEL" cmd /k "cd /d %~dp0 && pnpm dev:panel"

:summary
echo.
echo ============================================================
echo   LISTO. Todo corriendo en local.
echo ============================================================
echo   API ............ http://localhost:3000
echo   PANEL VISUAL ... http://localhost:4000   <-- abre esto
echo                     (Dashboard / Citas / Pacientes / Agente)
echo   Health ......... http://localhost:3000/healthz
echo   Metricas ....... http://localhost:3000/metrics
echo.
echo   Para parar: cierra las ventanas DENTIST-API y DENTIST-PANEL,
echo               o ejecuta stop-local.bat
echo ============================================================
goto :eof

:fail
echo.
echo [ERROR] Fallo el arranque local. Revisa el mensaje de arriba.
pause
exit /b 1
