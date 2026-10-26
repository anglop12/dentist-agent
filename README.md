# Agente Odontológico IA

> Agente conversacional especializado para consultorios odontológicos.
> Reemplaza y potencia el sistema legado descrito en `agente.md`.

## Stack

- **Runtime:** Node.js 20 LTS
- **Lenguaje:** TypeScript 5.x (strict)
- **Framework:** NestJS 10.x
- **ORM:** Drizzle + SQLite (better-sqlite3)
- **LLM:** Ollama (local por defecto) / Anthropic / OpenAI
- **Canales:** WhatsApp (Baileys), WebSocket, REST, Webhooks
- **Tests:** Vitest + @nestjs/testing

## Estructura del monorepo

```
agente-odontologico/
├── apps/
│   ├── api/      # NestJS app principal (REST + WS + Webhooks)
│   ├── worker/   # Cron + job runner (recordatorios, no-show)
│   └── panel/    # Panel web mínimo (HTMX + Tailwind)
├── test/         # Tests unit/integration/e2e
├── db/           # Migraciones + seeds Drizzle
├── bin/          # Scripts CLI (replicate, migrate)
├── docker/       # Dockerfile + compose
├── docs/         # Documentación
└── .github/      # CI
```

## Quick start (un clic)

### Opción A — Local con Laragon
Doble clic en **`start-local.bat`**: instala dependencias, crea `.env`,
aplica migraciones, siembra el catálogo y abre **API (:3000) + Panel visual (:4000)**.

**Parte visual** → abre `http://localhost:4000`:
- 📊 **Dashboard** — KPIs (citas, no-show, conversión)
- 📅 **Citas** — tabla con filtros por estado + botón Cancelar (HTMX, sin recargar)
- 👥 **Pacientes** — búsqueda en vivo
- 🤖 **Agente** — chat real contra el agente (usa las tools: identificar paciente, disponibilidad, crear cita)

Parar: `stop-local.bat` · Probar API: `test-api.bat`

### Opción B — Docker
Doble clic en **`start-docker.bat`**: construye la imagen, aplica migraciones,
levanta el contenedor y espera a que esté saludable.
Parar: `stop-docker.bat` · Probar: `test-api.bat`
Con LLM local real: elegir opción 2 en el script (perfil Ollama).

> El panel corre fuera de Docker por diseño (sirve estático+HTMX); apunta al
> API con la variable `API_URL` si el contenedor no está en localhost.

> **Nota:** el proyecto se ejecuta con `ts-node` en dev y compila con `tsc`
> (`nest build`) en Docker. `tsx`/esbuild no emite `emitDecoratorMetadata`
> y rompe la inyección de dependencias de NestJS.

### Verificación manual

```bash
curl http://localhost:3000/healthz
# {"status":"ok","db":true,"llm":true,"queue":{"pending":0,"running":0}}

# Probar el agente (MockLLM si no hay Ollama)
curl -X POST http://localhost:3000/conversation/message \
  -H "Content-Type: application/json" \
  -d '{"channel":"web","externalId":"+584141234567","text":"hola"}'
```

## Replicar para un nuevo consultorio

```bash
pnpm replicate --config=clinica-xyz.json
```

## Tests

```bash
pnpm test          # todos los tests
pnpm test:unit     # solo dominio (sin NestJS)
pnpm test:e2e      # tests e2e del API
```

## Comandos CLI

| Comando | Descripción |
|---------|-------------|
| `pnpm dev:api` | NestJS con hot reload en :3000 |
| `pnpm dev:worker` | Worker de recordatorios |
| `pnpm dev:panel` | Panel HTMX en :4000 |
| `pnpm db:migrate` | Aplica migraciones |
| `pnpm db:seed` | Carga datos iniciales |
| `pnpm db:studio` | UI Drizzle para la BD |
| `pnpm migrate --reset` | �️ Borra y recrea la BD |
| `pnpm migrate --status` | Lista tablas existentes |
| `pnpm replicate --config=cfg.json` | Replica para nuevo consultorio |

## Fases de desarrollo

Ver `agente.md` sección 9 para el plan completo:

- **F0** — Setup monorepo + NestJS + Drizzle + schema
- **F1** — Identity + Scheduling (CRUD citas)
- **F2** — ConversationModule + Orchestrator + Planner + Executor + 8 tools
- **F3** — WhatsApp adapter + Worker de recordatorios
- **F4** — FSM completa + Pagos (Stripe / MercadoPago)
- **F5** — Observabilidad + Reporting + Replicabilidad + Panel HTMX

## Arquitectura

Ver `docs/architecture.md` para el detalle completo:

- Hexagonal + DDD + Clean Code + SOLID
- Domain puro TS (sin `@nestjs/*`)
- Inversión de dependencias vía ports
- ConversationMemory + Event Listeners + Output Sanitizer
- Idempotency keys en citas, jobs y mensajes WA
- Caché de catálogos y KPIs invalidada por eventos
- Métricas Prometheus completas (`agent_messages_total`, `agent_tool_calls_total`, etc.)
- OpenTelemetry y Sentry opcionales

## Documentación

- `docs/README.md` — overview
- `docs/architecture.md` — capas, módulos, SOLID, patrones
- `docs/api.md` — endpoints REST + WS
- `docs/tools.md` — catálogo de tools
- `docs/operations.md` — deploy, troubleshooting
- `docs/development.md` — setup local, convenciones
- `docs/reporting.md` — KPIs y métricas
- `docs/panel.md` — panel HTMX

## Licencia

Privado / Consultorio.
