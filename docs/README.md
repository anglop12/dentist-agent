# Resumen del Agente Odontológico IA

> Este documento es la **entrada principal** al proyecto. Para detalle técnico,
> ver `architecture.md`, `api.md`, `tools.md`, `operations.md`, `development.md`.
> Para decisiones arquitectónicas, ver `agente.md` (documento de origen).

---

## ¿Qué es?

Un **agente conversacional IA** para consultorios odontológicos que:

- � Agenda, reagenda y cancela citas por WhatsApp / Web / Telegram.
- � Entiende lenguaje natural (gracias a un LLM intercambiable).
- 🛡️ Está protegido por una FSM + validación Zod → cero acciones fuera de contexto.
- 🏥 Replicable: una instancia por consultorio, sin multi-tenant.
- 💬 **Sin PHI al LLM** — la entidad `Patient` anonimiza datos sensibles.

---

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 20 LTS |
| Lenguaje | TypeScript 5.x (strict) |
| Framework | NestJS 10.x |
| ORM | Drizzle + better-sqlite3 |
| LLM | Ollama (local) / Anthropic / OpenAI |
| Canales | WhatsApp (Baileys), WebSocket, Webhook |
| Tests | Vitest |

---

## Fases completadas

| Fase | Descripción | Estado |
|------|-------------|--------|
| **F0** | Setup monorepo + NestJS + Drizzle + schema inicial | ✅ |
| **F1** | Identity + Scheduling + Availability modules | ✅ |
| **F2** | ConversationModule + AgentService + 8 tools + LLM providers | ✅ |
| **F3** | WhatsApp (Baileys) + Worker de recordatorios | ✅ |
| **F4** | FSM completa de cita + Stripe/MercadoPago | ✅ |
| **F5** | Health checks + métricas + bin/replicate | ✅ |
| F6 | n8n, multi-idioma, voz, RAG | 📋 opcional |

---

## Estructura de archivos clave

```
apps/api/src/
├── domain/                          # Pure TS (sin @nestjs/*)
│   ├── identity/                    # Patient, Doctor, Specialty
│   ├── scheduling/                  # MedicalAppointment + FSM
│   ├── availability/                # Slot, DailyCapacity
│   ├── conversation/                # Conversation + FSM
│   ├── communication/               # IChannel port
│   ├── intelligence/                # ILLMProvider + Tool
│   ├── jobs/                        # IJobQueue port
│   ├── payments/                    # IPaymentProvider port
│   └── shared/                      # Value Objects, Events
├── modules/                         # NestJS modules
│   ├── identity/                    # Controllers + UseCases
│   ├── scheduling/
│   ├── availability/
│   ├── conversation/                # Agent + Tools + WS Gateway
│   ├── communication/               # Canales + Jobs
│   ├── payments/
│   └── health/
├── infrastructure/                  # Adapters
│   ├── database/                    # Drizzle + repos SQLite
│   ├── llm/                         # Ollama/Anthropic/OpenAI
│   ├── channels/                    # WhatsApp Baileys, WS
│   ├── jobs/                        # Worker + handlers
│   ├── events/                      # EventEmitter bridge
│   └── payments/                    # Stripe, MercadoPago
├── shared/                          # utils cross-cutting
├── config/                          # Zod env validation
├── app.module.ts                    # composición raíz
└── main.ts                          # bootstrap
```

---

## Cómo empezar

```bash
# 1. Instalar
pnpm install

# 2. Configurar
cp .env.example .env
# Editar .env: LLM_PROVIDER, WA_PHONE, etc.

# 3. Generar y aplicar migraciones
pnpm db:generate
pnpm db:migrate

# 4. Seed
pnpm db:seed

# 5. Arrancar
pnpm dev:api        # API en :3000
pnpm dev:worker     # Worker (recordatorios)
```

Documentación Swagger en: **http://localhost:3000/api/docs**

---

## Comandos principales

| Comando | Qué hace |
|---------|----------|
| `pnpm dev:api` | NestJS con hot reload |
| `pnpm dev:worker` | Worker de recordatorios |
| `pnpm test` | Todos los tests |
| `pnpm test:unit` | Solo dominio |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | Aplica migraciones |
| `pnpm db:seed` | Carga datos iniciales |
| `pnpm db:studio` | UI Drizzle para la BD |
| `pnpm replicate` | Replica para nuevo consultorio |

---

## Decisiones clave (TL;DR)

1. **Hexagonal + DDD + Clean Code** — el dominio sobrevive a cualquier cambio de proveedor.
2. **NestJS sobre Express/Hono** — módulos + DI + OpenAPI + WebSocket nativos.
3. **SQLite por defecto, PostgreSQL opcional** — 0 procesos extra, 1 archivo.
4. **Cola de jobs en SQLite** — sin Redis obligatorio.
5. **Ollama por defecto, Anthropic/OpenAI opcionales** — PHI no sale del consultorio.
6. **Sin multi-tenant** — una instancia por consultorio, replicable vía `bin/replicate.ts`.
7. **Paciente sin tipos** — eliminamos titular/beneficiario/externo.

---

## KPIs objetivo

| KPI | Objetivo |
|-----|----------|
| Memoria en idle | < 250 MB |
| Latencia P95 | < 5 s |
| No-asistencia | < 8 % |
| Conversación resuelta sin humano | > 85 % |
| Tiempo de replicar consultorio | < 30 min |
| Cobertura tests domain/ | > 80 % |

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| LLM alucina tool call | Validación Zod + FSM de estados |
| Costo de tokens | Presupuesto por conversación + Ollama local |
| Latencia LLM remoto | Streaming + modelo pequeño por defecto |
| Cambio de API WhatsApp | Adapter aislado, switch a Twilio = 1 archivo |
| BD crece demasiado | Path upgrade a Postgres documentado |
| Loop infinito del agente | `MAX_ITERATIONS=8` |
| Paciente envía audio/foto | Tools de transcripción (Whisper) — F6 |

---

## Referencias

- **Arquitectura detallada:** `docs/architecture.md`
- **API REST + WS:** `docs/api.md`
- **Catálogo de tools:** `docs/tools.md`
- **Operaciones (deploy, logs):** `docs/operations.md`
- **Desarrollo local:** `docs/development.md`
- **Plan original (ADRs):** `agente.md`
