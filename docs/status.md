# Estado del Proyecto — Verificado en funcionamiento

> Última verificación: todos los endpoints probados y funcionando.

---

## ✅ Endpoints verificados (11/11 OK)

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/healthz` | GET | ✅ | BD + LLM + cola de jobs |
| `/readyz` | GET | ✅ | Readiness |
| `/metrics` | GET | ✅ | Prometheus (prom-client, 189+ líneas) |
| `/doctors` | GET/POST | ✅ | CRUD doctores |
| `/patients` | GET/POST/PATCH/DELETE | ✅ | CRUD pacientes |
| `/appointments` | GET/POST | ✅ | Crear/listar citas |
| `/appointments/:id/status` | PATCH | ✅ | FSM: pending→confirmed→... |
| `/appointments/:id/reschedule` | PATCH | ✅ | Reagendar con validación de slot |
| `/appointments/:id/cancel` | PATCH | ✅ | Cancelar con razón |
| `/availability` | GET | ✅ | Slots libres + capacidad |
| `/reporting/summary` | GET | ✅ | KPIs (no-show, conversión) |
| `/reporting/daily` | GET | ✅ | Métricas diarias |
| `/conversation/message` | POST | ✅ | Agente ReAct (MockLLM/Ollama) |
| WS `/agent` | WebSocket | ✅ | Streaming de tokens |

## ✅ Flujos de negocio verificados

1. **Crear cita** → persiste + dispara `AppointmentCreated`
2. **Anti-duplicado** → slot ocupado devuelve 409
3. **Cupo diario** → exceder `dailyLimit` devuelve 422
4. **FSM de cita** → transición inválida (cancelled→confirmed) devuelve 422
5. **Event listeners** → al crear cita se encolan jobs T-24h y T-2h automáticamente
6. **event_log** → los 4 tipos de eventos persisten (Created, Cancelled, Rescheduled, StatusChanged)
7. **Agente ReAct** → tool call (`identify_patient`) → resultado → respuesta contextual
8. **Conversaciones** → persisten en BD con historial de mensajes

## 🔧 Bugs corregidos (cronología)

### 1. Inyección de dependencias `undefined` (CAUSA RAÍZ)
**Síntoma:** todos los controllers recibían `undefined` en dependencias por tipo.
**Causa:** `tsx` usa esbuild que NO soporta `emitDecoratorMetadata`. Sin ese metadata,
NestJS no puede resolver inyecciones por tipo de clase.
**Fix:** migrar de `tsx` a `ts-node --transpile-only -r tsconfig-paths/register`.
Las inyecciones con `@Inject(SYMBOL)` explícito siempre funcionaron (el token vive en runtime).

### 2. Imports obsoletos y rutas rotas
- `baileys-whatsapp.channel.ts` importaba `agent.service` (eliminado) → stub limpio sin deps
- Rutas relativas incorrectas en múltiples archivos (`../../` vs `../../../`)
- Import dinámico con ruta errónea en `event-listeners.ts` → event_log nunca persistía

### 3. Providers LLM duplicados en DI
`OllamaProvider`, etc. tienen constructores con strings (no injectables). Al
registrarlos como providers, NestJS intentaba inyectarlos y fallaba.
**Fix:** solo la factory se registra; las clases se instancian manualmente.

### 4. Módulos sin exportar use cases
`ConversationModule` necesita `ScheduleAppointmentUseCase` de `SchedulingModule`,
que no lo exportaba. **Fix:** exports completos.

### 5. forwardRef innecesario
Se agregó `forwardRef()` a imports sin circularidad real, retrasando resolución.
**Fix:** eliminados todos — no hay dependencias circulares entre módulos.

### 6. WebSocketChannel con param constructor tipado
`constructor(private readonly socket?: Socket)` hacía que NestJS intentara
inyectar `Socket`. **Fix:** constructor vacío + método `bindSocket()`.

### 7. Sombra de método por propiedad inyectada
`private readonly metrics: MetricsCollector` sombreaba el método `metrics()` del
HealthController → "callback.apply is not a function".
**Fix:** método renombrado a `prometheusMetrics()`.

### 8. Eventos de dominio nunca publicados
Los use cases tenían `publishEvent()` como stub vacío.
**Fix:** inyectado `EventEmitter2` y publicando eventos reales.

### 9. MockLLM en bucle infinito
Siempre proponía la misma tool sin leer resultados previos.
**Fix:** detecta si el último mensaje es resultado de tool y responde en consecuencia.

### 10. KpiCache/MetricsCollector duplicados
Instancias separadas en ConversationModule y ReportingModule → métricas divididas.
**Fix:** `ObservabilityModule` global único.

## 🚀 Comandos para levantar

```bash
pnpm install
cp .env.example .env
pnpm migrate        # crea 11 tablas
pnpm db:seed        # doctor + especialidades + estados
pnpm dev:api        # API en :3000
```

## 📋 Pendiente opcional (F6)

- WhatsApp real (instalar Baileys: `pnpm add @whiskeysockets/baileys`)
- Ollama real para LLM local (`winget install Ollama.Ollama && ollama pull qwen2.5:7b`)
- Swagger (deshabilitado por bug de reflection con ts-node; funciona con `nest build`)
- Panel HTMX end-to-end (estructura creada, falta conectar)
