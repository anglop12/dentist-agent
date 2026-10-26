@echo off
title Parar Agente Dental (Docker)
cd /d "%~dp0"
echo [..] Deteniendo contenedores...
docker compose -f docker\docker-compose.yml --profile ollama down
echo [OK] Docker detenido. Los datos persisten en .\storage\
pause
