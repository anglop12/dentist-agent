# Operations Guide

> Cómo desplegar, operar, monitorear y troubleshoot el Agente Odontológico.

---

## Despliegue rápido

### Local (desarrollo)

```bash
pnpm install
cp .env.example .env
# Editar .env: LLM_PROVIDER, etc.

pnpm --filter @dentist/api db:generate   # crea db/migrations/*.sql
pnpm --filter @dentist/api db:migrate   # aplica a SQLite
pnpm --filter @dentist/api db:seed      # datos iniciales

pnpm dev:api       # NestJS API en :3000
pnpm dev:worker    # cron + recordatorios
pnpm dev:panel     # (futuro) panel web
```

### Docker Compose (recomendado para VPS)

```bash
docker compose -f docker/docker-compose.yml up -d
```

Levanta:
- `api` → NestJS API en :3000
- `worker` → cron + recordatorios
- `ollama` → LLM local (opcional)

### Replicar para nuevo consultorio

```bash
pnpm replicate --config=clinica-xyz.json
```

Esto genera `.env` + seed específico del consultorio. Cada instancia es
independiente: su BD, sus canales, su LLM provider.

---

## Variables de entorno

Ver `.env.example`. Categorías:

- **App:** NODE_ENV, APP_PORT, LOG_LEVEL
- **DB:** DATABASE_URL (default `./storage/clinic.sqlite`)
- **LLM:** LLM_PROVIDER (ollama|anthropic|openai), LLM_MODEL
- **Canales:** WA_ENABLED, WA_SESSION_PATH
- **Agente:** AGENT_MAX_ITERATIONS, AGENT_TOKEN_BUDGET
- **Jobs:** JOB_POLL_INTERVAL_MS
- **Pagos:** STRIPE_*, MERCADOPAGO_*
- **Observabilidad:** OTEL_ENABLED, SENTRY_DSN

---

## Health checks

| Endpoint | Verifica |
|----------|----------|
| `GET /healthz` | BD + LLM provider + queue pending/running |
| `GET /readyz` | App arrancó sin errores |
| `GET /metrics` | Métricas Prometheus básicas |

```bash
curl http://localhost:3000/healthz
# { "status": "ok", "db": true, "llm": true, "queue": { "pending": 0, "running": 0 } }
```

---

## Logs

Estructurados (Pino) en JSON. Cada conversación tiene un `traceId` que
aparece en todos sus logs.

```bash
# Logs en dev (pino-pretty)
pnpm dev:api

# Producción: redirigir a archivo
node apps/api/dist/main.js > /var/log/dentist/api.log 2>&1

# Opciones:
# - journalctl -u dentist-api -f
# - docker logs dentist-api -f
```

---

## Monitoreo

### Métricas Prometheus (mínimas)

```promql
agent_uptime_seconds         # segundos desde arranque
agent_memory_rss_bytes       # memoria RSS
agent_messages_total         # contador de mensajes (TODO F5)
agent_tool_calls_total       # tool calls
agent_tokens_total           # tokens consumidos
```

### OpenTelemetry (opcional)

Activar con `OTEL_ENABLED=true`. Exporta a consola por defecto; configurar
OTLP endpoint en producción.

---

## Troubleshooting

### La app no arranca

1. Revisar `NODE_ENV` y `.env`.
2. `pnpm --filter @dentist/api db:migrate` se ejecutó?
3. El puerto 3000 está libre?
4. Si `LLM_PROVIDER=anthropic` y no hay API key → error claro al inicio.

### Ollama no responde

```bash
curl http://localhost:11434/api/tags   # debe devolver modelos
# Si no:
ollama serve &                          # arrancar
ollama pull qwen2.5:7b                  # descargar modelo
```

### WhatsApp no conecta

1. Verificar `WA_SESSION_PATH` existe y es escribible.
2. Escanear QR en terminal la primera vez.
3. Si se desautenticó (401), borrar `./storage/wa-session` y reescanear.
4. Cambios en API de Baileys: actualizar `@whiskeysockets/baileys`.

### BD crece mucho

- SQLite soporta ~1 GB sin problemas (~50k citas/mes × 2 años).
- Si excede: migrar a PostgreSQL (cambiar driver en `connection.ts`).
- Limpieza periódica: `DELETE FROM messages WHERE at < now() - INTERVAL '90 days'`.

### El agente se queda en loop

- `AGENT_MAX_ITERATIONS=8` previene loops infinitos.
- Si ocurre: revisar la FSM (¿algún estado permite tools circulares?).
- Logs del agente muestran iteración y tools llamadas.

---

## Backup

```bash
# Backup completo (incluye BD + sesión WhatsApp)
tar czf backup-$(date +%F).tar.gz storage/

# Solo BD
cp storage/clinic.sqlite backup/clinic-$(date +%F).sqlite

# Restaurar
tar xzf backup-2026-08-20.tar.gz
```

Para producción, configurar backup diario vía cron:

```cron
0 3 * * * cd /app && tar czf /backups/clinic-$(date +\%F).tar.gz storage/
```

---

## Updates

```bash
git pull
pnpm install
pnpm --filter @dentist/api db:migrate   # si hay nuevas migraciones
pnpm --filter @dentist/api db:generate  # si hay cambios de schema

# Reiniciar
docker compose -f docker/docker-compose.yml restart api worker
```

---

## Seguridad

- `.env` con secretos NUNCA en repo. Documentado en `.env.example`.
- Rate limit por IP/conversation vía `@nestjs/throttler`.
- Audit log en `audit_log` para acciones sensibles.
- Sin PHI al LLM (ver `docs/tools.md`).
- Idempotency keys en operaciones externas.

---

## Escalamiento

- 1 instancia soporta ~100 conversaciones concurrentes (~40 msg/seg).
- Si excede: clonar BD a PostgreSQL y escalar horizontalmente.
- Redis opcional: sustituir `SqliteJobQueue` por BullMQ sin tocar código
  que encola (gracias al port `IJobQueue`).
