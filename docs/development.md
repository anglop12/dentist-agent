# Development Guide

> Cómo desarrollar localmente: setup, estructura de código, convenciones, testing.

---

## Setup local

### Prerequisitos

- Node.js 20 LTS (≥20.0.0)
- pnpm 11.x (`corepack enable && corepack prepare pnpm@11 --activate`)
- Git
- SQLite (incluido vía better-sqlite3, no requiere binario aparte)

### Para LLM local (opcional)

- Ollama: https://ollama.com/download
- Modelo: `ollama pull qwen2.5:7b` (default, ~4 GB)

### Para WhatsApp (opcional)

Solo necesario si pruebas el adapter Baileys. Lee el QR desde terminal.

---

## Estructura

```
dentist-agent/
├── apps/
│   ├── api/                # NestJS principal (REST + WS)
│   │   └── src/
│   │       ├── main.ts                 # bootstrap
│   │       ├── app.module.ts           # composición raíz
│   │       ├── modules/                # bounded contexts
│   │       │   ├── identity/           # Patient, Doctor, Specialty
│   │       │   ├── scheduling/         # Appointment, FSM
│   │       │   ├── availability/       # Slot, DailyCapacity
│   │       │   ├── conversation/       # Agent, Tools, FSM
│   │       │   ├── communication/      # Canales (WhatsApp, WS)
│   │       │   ├── payments/           # Stripe, MercadoPago
│   │       │   └── health/             # /healthz, /metrics
│   │       ├── infrastructure/         # adapters
│   │       │   ├── database/           # Drizzle + repos
│   │       │   ├── llm/                # providers
│   │       │   ├── channels/           # Baileys, WS
│   │       │   ├── jobs/               # worker + handlers
│   │       │   ├── events/             # event bus
│   │       │   └── payments/           # providers pagos
│   │       ├── domain/                 # pure TS (sin @nestjs/*)
│   │       │   ├── identity/
│   │       │   ├── scheduling/
│   │       │   ├── availability/
│   │       │   ├── conversation/
│   │       │   ├── communication/
│   │       │   ├── intelligence/       # LLM port, Tool
│   │       │   ├── jobs/
│   │       │   ├── payments/
│   │       │   └── shared/
│   │       ├── shared/                 # utils cross-cutting
│   │       │   ├── errors/
│   │       │   ├── types/
│   │       │   └── utils/
│   │       └── config/                 # Zod-validated env
│   └── worker/             # standalone cron runner
├── bin/                    # CLI scripts
├── db/                     # migrations + seeds
├── docker/                 # Dockerfile + compose
├── docs/                   # documentación
└── test/                   # tests e2e (unit en cada módulo)
```

---

## Convenciones de código

### Naming

- Archivos: `kebab-case.ts` (e.g., `schedule-appointment.usecase.ts`)
- Clases: `PascalCase` (e.g., `ScheduleAppointmentUseCase`)
- Métodos públicos: `camelCase` (e.g., `execute`, `byId`)
- Constantes: `UPPER_SNAKE_CASE` (e.g., `MAX_ITERATIONS`)
- Símbolos DI: `UPPER_SNAKE_CASE` como `Symbol` (e.g., `LLM_PROVIDER`)

### Inyección de dependencias

- Use cases y adapters: `@Injectable()` con dependencias por constructor.
- Tokens definidos en el dominio (`apps/api/src/domain/<context>/`).
- Implementaciones registradas en módulos vía `useClass` o `useFactory`.

```ts
@Injectable()
export class ScheduleAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: IPatientRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}
}
```

### Domain rules

- **No `@nestjs/*` en domain/**. Solo TypeScript puro.
- Entidades encapsulan invariantes; lanzan `BusinessRuleError` o `ValidationError`.
- Repositorios son interfaces en domain; implementaciones en infrastructure.

### Tests

- **Unit** (`*.spec.ts` junto al código): para domain entities y value objects.
- **Integration** (`*.int-spec.ts`): para use cases con `@nestjs/testing`.
- **E2E** (`test/e2e/*.e2e-spec.ts`): API completa con `supertest`.

Cobertura objetivo: > 80% en domain/ y use cases.

### Validación

- DTOs HTTP: `class-validator` + `@nestjs/swagger` decorators.
- Use cases: `zod` schemas para validar input.
- Tools: `zod` schemas en `inputSchema`.

---

## Comandos

```bash
# Desarrollo
pnpm dev:api           # NestJS con --watch
pnpm dev:worker        # Worker con --watch

# Build
pnpm build             # compila todo

# Tests
pnpm test              # todos
pnpm test:unit         # solo domain (sin NestJS)
pnpm test:e2e          # API completa

# Lint + format
pnpm lint

# DB
pnpm db:generate       # genera migración SQL desde schema TS
pnpm db:migrate        # aplica migraciones
pnpm db:seed           # carga datos iniciales
pnpm db:studio         # UI Drizzle

# Replicar
pnpm replicate --config=clinica-xyz.json
```

---

## Workflow para añadir features

### Ejemplo: añadir una tool nueva

1. Definir schema Zod + lógica en `apps/api/src/modules/conversation/tools/<name>.tool.ts`
2. Registrar en `AgentService.registerDefaultTools()`:
   ```ts
   this.tools.register(MyNewTool);
   ```
3. Si requiere nuevo estado FSM, actualizar `conversation-fsm.ts`
4. Test e2e en `test/e2e/agent.e2e-spec.ts`

### Ejemplo: añadir un canal (Telegram)

1. Implementar `IChannel` en `apps/api/src/infrastructure/channels/telegram.channel.ts`
2. Registrar en `CommunicationModule.providers` y `CHANNEL_REGISTRY`
3. Listo. El `ConversationController` ya lo soporta.

### Ejemplo: cambiar de SQLite a PostgreSQL

1. Instalar `drizzle-orm/postgres-js` + `postgres`
2. Crear `apps/api/src/infrastructure/database/postgres-connection.ts`
3. Reimplementar repos (o usar Drizzle multi-driver)
4. Cambiar `DATABASE_DRIVER=postgres` en `.env`

---

## Debugging

### Logs del agente

Cada conversación tiene `traceId`. Para filtrar:

```bash
# En pino-pretty dev:
pnpm dev:api | grep "traceId=conv-xxx"

# En producción JSON:
cat api.log | jq 'select(.traceId == "conv-xxx")'
```

### Inspeccionar SQLite

```bash
sqlite3 storage/clinic.sqlite
> .tables
> SELECT * FROM conversations LIMIT 5;
> SELECT * FROM messages WHERE conversationId = 'xxx' ORDER BY at;
```

### Probar tools manualmente

```ts
// En un REPL o test:
const tool = IdentifyPatientTool;
const result = await tool.execute(
  { phone: '+584141234567' },
  { conversationId: 't', channel: 't', state: 't', deps: { patientRepo: ... } },
);
```

---

## CI

`.github/workflows/ci.yml` corre en cada push:
- pnpm install
- lint
- type-check (`tsc --noEmit`)
- unit tests
- build

Para añadir checks:
- e2e (requiere DB en CI): añadir job separado con `services: sqlite`.
- Coverage report: añadir `vitest --coverage` y subir a codecov.

---

## Recursos útiles

- [NestJS docs](https://docs.nestjs.com)
- [Drizzle ORM](https://orm.drizzle.team)
- [Baileys (WhatsApp)](https://github.com/WhiskeySockets/Baileys)
- [Ollama](https://ollama.com)
- [Anthropic API](https://docs.anthropic.com)
