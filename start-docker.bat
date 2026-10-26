@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title Agente Dental - Docker
cd /d "%~dp0"

echo ============================================================
echo   AGENTE ODONTOLOGICO IA  ^|  Arranque con DOCKER
echo ============================================================
echo.

where docker >nul 2>&1 || (echo [ERROR] Docker no esta instalado o no esta corriendo & goto :fail)
docker info >nul 2>&1 || (echo [ERROR] El daemon de Docker no responde. Abre Docker Desktop. & goto :fail)
echo [OK] Docker activo

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  powershell -NoProfile -Command "(Get-Content '.env') -replace '^LLM_PROVIDER=.*','LLM_PROVIDER=mock' -replace '^WA_ENABLED=.*','WA_ENABLED=false' | Set-Content '.env'"
  echo [OK] .env creado (mock LLM)
) else (
  echo [OK] .env existente respetado
)

echo.
echo ¿Que perfil quieres arrancar?
echo   [1] Basico    - API + MockLLM (rapido, ~1 min build)
echo   [2] Con Ollama- API + LLM local real (requiere descargar ~4GB de modelo)
set /p PERFIL="Elige 1 o 2 [1]: "
if "%PERFIL%"=="2" goto :ollama

:basico
echo [..] Construyendo y levantando contenedores (basico)...
docker compose -f docker\docker-compose.yml up -d --build || goto :fail
goto :wait

:ollama
echo [..] Construyendo y levantando contenedores (+perfil ollama)...
docker compose -f docker\docker-compose.yml --profile ollama up -d --build || goto :fail
echo [..] Descargando modelo qwen2.5:7b en Ollama (tarda segun red)...
start "OLLAMA-PULL" cmd /k "docker exec dentist-ollama ollama pull qwen2.5:7b"
powershell -NoProfile -Command "(Get-Content '.env') -replace '^LLM_PROVIDER=.*','LLM_PROVIDER=ollama' | Set-Content '.env'"
docker compose -f docker\docker-compose.yml up -d api

:wait
echo [..] Esperando a que la API este saludable (hasta 3 min)...
set TRIES=0
:waitloop
timeout /t 5 /nobreak >nul
set /a TRIES+=1
curl -s -o nul -m 3 http://localhost:3000/healthz
if errorlevel 1 (
  if !TRIES! lss 36 goto :waitloop
  echo [WARN] Sin respuesta tras 3 min. Ultimos logs:
  docker logs dentist-api --tail 30
  goto :fail
)

echo.
echo ============================================================
echo   LISTO. Todo corriendo en Docker.
echo ============================================================
echo   API ............ http://localhost:3000
echo   Health ......... http://localhost:3000/healthz
echo   Metricas ....... http://localhost:3000/metrics
echo   Contenedor ..... dentist-api   (BD persistida en .\storage)
echo.
echo   Comandos utiles:
echo     Ver logs ...... docker logs -f dentist-api
echo     Parar ......... stop-docker.bat
echo     Probar todo ... test-api.bat
echo ============================================================
goto :eof

:fail
echo.
echo [ERROR] Fallo el arranque en Docker.
pause
exit /b 1
