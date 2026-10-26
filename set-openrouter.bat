@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Configurar OpenRouter
cd /d "%~dp0"

echo ============================================================
echo   CONFIGURAR OPENROUTER (IA gratis en la nube)
echo ============================================================
echo.
echo   1. Ve a  https://openrouter.ai/keys  y crea tu key (gratis)
echo   2. Pega aqui tu key cuando te la pida
echo.

set /p ORKEY="Pega tu OPENROUTER_API_KEY (sk-or-v1-...): "
if "%ORKEY%"=="" (echo [ERROR] No escribiste ninguna key & pause & exit /b 1)
if not "%ORKEY:~0,8%"=="sk-or-v1" (
  echo [WARN] La key normalmente empieza con "sk-or-v1". Continuando de todos modos...
)

echo.
echo Modelos gratuitos recomendados (terminan en :free^):
echo   [1] meta-llama/llama-3.3-70b-instruct:free   (70B, default^)
echo   [2] deepseek/deepseek-chat-v3-0324:free      (razonamiento^)
echo   [3] qwen/qwen-2.5-72b-instruct:free          (buen espanol^)
echo   [4] google/gemini-2.0-flash-exp:free         (rapido^)
echo   [5] Escribir otro manualmente
set /p OPC="Elige 1-5 [1]: "

set ORMODEL=meta-llama/llama-3.3-70b-instruct:free
if "%OPC%"=="2" set ORMODEL=deepseek/deepseek-chat-v3-0324:free
if "%OPC%"=="3" set ORMODEL=qwen/qwen-2.5-72b-instruct:free
if "%OPC%"=="4" set ORMODEL=google/gemini-2.0-flash-exp:free
if "%OPC%"=="5" set /p ORMODEL="Escribe el nombre exacto del modelo: "

REM ---------- Actualizar .env ----------
powershell -NoProfile -Command ^
  "$f='.env'; $c=Get-Content $f -Raw;" ^
  "$c=$c -replace '(?m)^LLM_PROVIDER=.*','LLM_PROVIDER=openrouter';" ^
  "if($c -match '(?m)^OPENROUTER_API_KEY='){$c=$c -replace '(?m)^OPENROUTER_API_KEY=.*','OPENROUTER_API_KEY=%ORKEY%'}else{$c+=\"`nOPENROUTER_API_KEY=%ORKEY%\"};" ^
  "if($c -match '(?m)^OPENROUTER_MODEL='){$c=$c -replace '(?m)^OPENROUTER_MODEL=.*','OPENROUTER_MODEL=%ORMODEL%'}else{$c+=\"`nOPENROUTER_MODEL=%ORMODEL%\"};" ^
  "Set-Content $f $c -Encoding UTF8"

echo [OK] .env configurado:
Select-String -Path ".env" -Pattern "^LLM_PROVIDER|^OPENROUTER_MODEL" | ForEach-Object { Write-Host "    $($_.Line)" }
Write-Host "    OPENROUTER_API_KEY=***oculta***"

REM ---------- Reiniciar API ----------
echo [..] Reiniciando API...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
timeout /t 2 /nobreak >nul
start "DENTIST-API (OpenRouter)" cmd /k "cd /d %~dp0 && pnpm dev:api"

echo [..] Esperando healthz...
set TRIES=0
:wait
timeout /t 3 /nobreak >nul
set /a TRIES+=1
curl -s -o nul -m 2 http://localhost:3000/healthz
if errorlevel 1 (
  if !TRIES! lss 20 goto :wait
  echo [WARN] Sin respuesta. Revisa la ventana DENTIST-API.
  pause & exit /b 1
)

echo.
echo ============================================================
echo   LISTO! OpenRouter activo con modelo:
echo     %ORMODEL%
echo ============================================================
echo   Prueba en http://localhost:4000 - Agente
echo ============================================================
pause
