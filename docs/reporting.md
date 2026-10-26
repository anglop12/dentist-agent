# Reporting & KPIs

> `ReportingModule` computa métricas del consultorio.

---

## Endpoints

### `GET /reporting/summary`

Resumen general de KPIs.

```json
{
  "appointments_total": 142,
  "appointments_by_status": {
    "pending": 8,
    "confirmed": 35,
    "completed": 87,
    "cancelled": 9,
    "no_show": 3
  },
  "no_show_rate": 3.3,
  "conversion_rate": 61.3,
  "avg_daily_appointments": 4.7,
  "estimated_revenue_cents": 1250000,
  "conversations_active": 2,
  "conversations_resolved": 89
}
```

### `GET /reporting/daily?from=YYYY-MM-DD&to=YYYY-MM-DD`

Métricas diarias para gráficas.

```json
[
  { "date": "2026-08-21", "total": 12, "confirmed": 10, "completed": 9, "cancelled": 1, "no_show": 0 },
  ...
]
```

### `GET /reporting/tokens?days=7`

Consumo de tokens del LLM (placeholder, requiere OTel para datos reales).

---

## KPIs definidos

| KPI | Fórmula | Objetivo |
|-----|---------|----------|
| `no_show_rate` | `no_show / (completed + no_show) × 100` | < 8% |
| `conversion_rate` | `completed / total × 100` | > 60% |
| `avg_daily_appointments` | promedio móvil 30 días | — |
| `estimated_revenue_cents` | suma de `depositAmount` de citas confirmadas+ | — |

---

## Caché de KPIs

`KpiCache` guarda valores JSON con TTL en tabla `kpi_cache`.

- TTL por defecto: 5 minutos.
- Se invalida automáticamente vía `EventListeners` cuando ocurre `AppointmentCreated`,
  `AppointmentCancelled`, `AppointmentStatusChanged`.
- Si la key expiró, devuelve `null` y el caller recomputa.

```ts
// Uso programático
const cached = await kpiCache.get<KpiSummary>('summary');
if (!cached) {
  const summary = await reportingService.getSummary();
  await kpiCache.set('summary', summary, 300);
}
```

---

## Métricas Prometheus (counter en tiempo real)

Además de los snapshots cacheados, `MetricsCollector` mantiene contadores
actualizados en tiempo real:

- `appointments_created_total{source}` — incrementa con cada `AppointmentCreated`.
- `appointments_no_show_total` — incrementa cuando una cita pasa a `no_show`.
- `agent_messages_total{channel,state}` — mensajes procesados por el agente.
- `agent_tool_calls_total{tool,outcome}` — invocaciones de tools.
- `agent_tokens_total{model,direction}` — tokens consumidos.

Acceso: `GET /metrics` (formato Prometheus).
