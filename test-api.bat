@echo off
title Agente Dental - Bateria de pruebas API
cd /d "%~dp0"
chcp 65001 >nul 2>&1

set BASE=http://localhost:3000
set PASS=0
set FAIL=0

echo ============================================================
echo   PRUEBAS API  ^|  %BASE%
echo ============================================================

call :check "GET  /healthz"            "%BASE%/healthz"
call :check "GET  /readyz"             "%BASE%/readyz"
call :check "GET  /metrics"            "%BASE%/metrics"
call :check "GET  /doctors"            "%BASE%/doctors"
call :check "GET  /patients"           "%BASE%/patients"
call :check "GET  /appointments"       "%BASE%/appointments"
call :check "GET  /reporting/summary"  "%BASE%/reporting/summary"

echo [..] POST /patients (crear paciente de prueba)
curl -s -o nul -w "%%{http_code}" -X POST "%BASE%/patients" -H "Content-Type: application/json; charset=utf-8" -d "{\"name\":\"Test\",\"lastname\":\"Auto\",\"age\":30,\"cedula\":98765432,\"email\":\"test.auto@mail.local\",\"phone\":\"+584120000001\",\"birthdate\":\"1995-01-01\",\"address\":\"X\",\"gender\":1}" > %TEMP%\_code
set /p CODE=<%TEMP%\_code
if "!CODE!"=="201" (echo   OK  201 & set /a PASS+=1) else (echo   FAIL !CODE! & set /a FAIL+=1)

echo [..] GET /availability (doctor-default, manana)
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set HOY=%%d
call :check "GET  /availability" "%BASE%/availability?doctorId=doctor-default&date=!HOY!"

echo [..] POST /conversation/message (agente)
curl -s -o nul -w "%%{http_code}" -X POST "%BASE%/conversation/message" -H "Content-Type: application/json; charset=utf-8" -d "{\"channel\":\"web\",\"externalId\":\"+584120000001\",\"text\":\"hola\"}" > %TEMP%\_code
set /p CODE=<%TEMP%\_code
if "!CODE!"=="201" (echo   OK  201 & set /a PASS+=1) else (echo   FAIL !CODE! & set /a FAIL+=1)

echo.
echo ============================================================
echo   RESULTADO: %PASS% OK  /  %FAIL% FALLOS
echo ============================================================
del %TEMP%\_code >nul 2>&1
pause
exit /b %FAIL%

:check
curl -s -o nul -m 5 "%~2"
if errorlevel 1 (echo   FAIL %~1 & set /a FAIL+=1) else (echo   OK   %~1 & set /a PASS+=1)
goto :eof
