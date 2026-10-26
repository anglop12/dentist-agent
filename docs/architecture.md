# Architecture

> Documento técnico de la arquitectura del Agente Odontológico IA.
> Refleja la implementación completa de F0 → F5.

---

## Vista de capas

```
┌──────────────────────────────────────────────────────────────────────┐
│  INTERFACE LAYER                                                       │
│  apps/api/src/modules/<context>/                                      │
│    • Controllers REST  (@Controller)                                  │
│    • WebSocket Gateways (@WebSocketGateway)                            │
│    • DTOs (class-validator + Swagger)                                 │
│    • WebhookController genérico (en webhooks module)                   │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                                     │
│  apps/api/src/modules/<context>/use-cases/                            │
│    • UseCases (@Injectable) orquestan domain + infra                  │
│    • ProcessIncomingMessageUseCase → AgentOrchestrator                │
│    • DTOs validados con Zod                                           │
│    • Tokens de DI: PATIENT_REPOSITORY, LLM_PROVIDER, etc.             │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER (PURE TYPESCRIPT, sin @nestjs/*)                       │
│  apps/api/src/domain/                                                  │
│    • Entities, Value Objects, Aggregates                              │
│    • FSM (AppointmentStatus, ConversationFSM)                          │
│    • Domain Events                                                    │
│    • Ports / interfaces (IChannel, ILLMProvider, ICalendarAdapter)    │
│    • 100% testeable sin framework                                     │
└──────────────────────────────────────────────────────────────────────�
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER (adapters)                                      │
│  apps/api/src/infrastructure/                                          │
│    • database/        Drizzle + SQLite repositories                  │
│    • llm/             Ollama, Anthropic, OpenAI providers             │
│    │                  + LLMFactory (resuelve el activo)                │
│    • channels/        WhatsApp Baileys, WebSocket                     │
│    • calendar/        GoogleCalendarAdapter (stub)                    │
│    • jobs/             In-process worker + ReminderDispatcher        │
│    • events/           NestJS EventEmitter bridge                     │
│    • payments/         Stripe, MercadoPago                            │
│    • caching/          KpiCache, CatalogCache                         │
│    • observability/    Metrics, AuditLogger, OpenTelemetry, Sentry    │
└──────────────────────────────────────────────────────────────────────┘
```

## Mapeo a NestJS

| Capa hexagonal  | NestJS Concept            | Ubicación                                  |
|-----------------|---------------------------|--------------------------------------------|
| Domain          | Clases TS puras           | `apps/api/src/domain/`                    |
| Application     | `@Injectable()` UseCases  | `apps/api/src/modules/<context>/use-cases/` |
| Infrastructure  | `@Injectable()` Adapters  | `apps/api/src/infrastructure/`             |
| Interface       | `@Controller()`, `@WebSocketGateway()` | `apps/api/src/modules/<context>/*.controller.ts` |
| Composition     | `AppModule`               | `apps/api/src/app.module.ts`              |

## Bounded Contexts (DDD)

```
IdentityModule        → Patient, Doctor, Specialty
SchedulingModule      → MedicalAppointment (aggregate + FSM)
AvailabilityModule    → Slot, DailyCapacity
ConversationModule    → Conversation + ConversationFSM
                        + AgentOrchestrator, PlannerService, ExecutorService
                        + ConversationMemory, EventListeners
CommunicationModule   → Channels (WhatsApp, WebSocket) + ChannelFactory
                        + ReminderDispatcher, JobsModule
PaymentsModule        → Stripe, MercadoPago adapters
ReportingModule       → KPIs (no-show, conversión, ingresos)
WebhooksModule        → WebhookController genérico + audit log
HealthModule          → /healthz, /readyz, /metrics (Prometheus)
```

Cada módulo expone sus repos vía `exports` y los tokens (`PATIENT_REPOSITORY`,
etc.) están definidos en el **dominio** (no en infra), siguiendo DIP.

## Inversión de dependencias

- El `AgentOrchestrator` depende de `ILLMProvider` (interface) → `LLMFactory` lo resuelve.
- `ChannelFactory` resuelve el canal activo desde un registry.
- Cambiar de LLM = editar `LLM_PROVIDER` en `.env`. Cero código.
- Cambiar de BD = nueva implementación de `IPatientRepository` (1 archivo).
- Cambiar WhatsApp = nueva implementación de `IChannel` (1 archivo).

## SOLID aplicado

| Principio | Implementación |
|-----------|----------------|
| SRP       | Cada UseCase hace UNA cosa. Cada Tool tiene UN propósito. AgentOrchestrator orquesta, Planner planifica, Executor ejecuta. |
| OCP       | Añadir canal = 1 adapter (sin tocar Orchestrator). Añadir tool = `tools.register()` (sin tocar Planner). Añadir listener = `@OnEvent()` decorator. |
| LSP       | Cualquier ILLMProvider es intercambiable vía LLMFactory. |
| ISP       | Repos separados en Read/Write si es necesario (no implementado por ahora, mismo port). |
| DIP       | Toda dependencia apunta a un port (interface) declarado en domain. |

---

## Patrones aplicados

- **Repository** (`IPatientRepository`, `IAppointmentRepository`)
- **Strategy** (`ILLMProvider` → `OllamaProvider`, `AnthropicProvider`)
- **Factory** (`LLMFactory`, `ChannelFactory`)
- **Observer** (Domain Events vía `@nestjs/event-emitter` con `@OnEvent`)
- **State Machine** (`AppointmentStatusVO`, `ConversationFSM`)
- **Tool Registry** (Strategy + Decorator, validación Zod)
- **Idempotency Key** (en citas, jobs y mensajes WA)
- **Cache-Aside** (`KpiCache`, `CatalogCache` con invalidación por eventos)
- **Circuit Breaker** (output sanitization rechaza texto peligroso)

---

## Ciclo de un mensaje

```
[Paciente WhatsApp]
        │
        ▼
[BaileysWhatsAppChannel.onMessage]
        │
        ▼
[ConversationController] → [ProcessIncomingMessageUseCase]
        │
        ▼
[AgentOrchestrator.handleMessage]
        │
        ├─ Carga/crea Conversation
        ├─ Loop ReAct (max 8 iter):
        │   1. PlannerService.plan(conversation)
        │      ├─ ConversationMemory.buildMessages (resumen si excede budget)
        │      └─ LLM.chat(messages, tools permitidas por FSM)
        │   2. Si reply → break
        │   3. Si tool_call:
        │      ├─ FSM.canUseTool(state, tool)? → NO → refuseToolReply
        │      ├─ ExecutorService.execute(tool, input, ctx)
        │      │   ├─ Zod safeParse
        │      │   ├─ Tool.execute
        │      │   └─ MetricsCollector.toolCalls.inc
        │      └─ push resultado al history
        │
        ├─ ConversationMemory.maybeCompact (si excede budget)
        ├─ OutputSanitizer.sanitize (rechaza texto peligroso)
        ├─ ConvRepo.save + MessageRepo.append
        ├─ Channel.send(externalId, { text })
        │
        ▼
[Event Listeners] (asíncrono)
   ├─ @OnEvent('AppointmentCreated') → encolar reminders T-24h, T-2h
   ├─ @OnEvent('AppointmentCreated') → sendWhatsAppConfirmation
   ├─ @OnEvent('AppointmentCreated') → metrics.appointmentsCreated.inc
   ├─ @OnEvent('AppointmentCreated') → KpiCache.invalidate
   └─ @OnEvent('**')               → persistir en event_log
```

---

## Recursos (objetivo)

| Recurso         | Objetivo    |
|-----------------|-------------|
| RAM idle (API)  | ~250 MB     |
| Arranque frío   | < 3 s       |
| Disco           | < 80 MB     |
| Throughput      | ~40 msg/seg |
| Latencia P95    | < 5 s       |

---

## Observabilidad

### Métricas Prometheus (expuestas en `/metrics`)

| Métrica | Labels | Tipo |
|---------|--------|------|
| `agent_messages_total` | channel, state | counter |
| `agent_tool_calls_total` | tool, outcome | counter |
| `agent_tokens_total` | model, direction | counter |
| `agent_latency_seconds` | stage | histogram |
| `agent_conversations_active` | channel | gauge |
| `appointments_created_total` | source | counter |
| `appointments_no_show_total` | — | counter |

### Logs

- Pino estructurado (JSON).
- `traceId` por conversación (TODO F5: añadir interceptor).
- OpenTelemetry opcional (`OTEL_ENABLED=true`) exporta a consola.
- Sentry opcional (`SENTRY_DSN=...`) captura excepciones.

### Eventos de dominio (audit + replay)

- `event_log` tabla: persiste TODO evento automáticamente vía `@OnEvent('**')`.
- `audit_log` tabla: `AuditLogger.log({ actor, action, resource, payload })`.

---

## Referencias

- `agente.md` → ADRs completos
- `docs/agent.md` (en `docs/README.md`) → overview funcional
- `docs/tools.md` → catálogo de tools
- `docs/operations.md` → deploy, logs, troubleshooting
- `docs/development.md` → setup local, convenciones
- `docs/api.md` → referencia API REST/WS
