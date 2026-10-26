# API Reference

> Endpoints REST del Agente Odontológico IA.
> OpenAPI completo en `/api/docs` al arrancar la app.

---

## Autenticación

Por defecto, sin auth (asumiendo deploy single-tenant en red privada).
Para producción, añadir Bearer token en `ADMIN_TOKEN`:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/...
```

---

## Patients

### `POST /patients`
Crea un paciente.

```json
{
  "name": "Juan",
  "lastname": "Pérez",
  "age": 35,
  "cedula": 12345678,
  "email": "juan@example.com",
  "phone": "+584141234567",
  "waPhone": "+584141234567",
  "birthdate": "1989-01-01",
  "address": "Calle 1",
  "gender": 1,
  "notes": "opcional"
}
```

**Respuesta 201:** `Patient` entity.

### `GET /patients?search=&limit=&offset=`
Lista pacientes (paginado).

### `GET /patients/:id`
Detalle de un paciente.

### `GET /patients/by-phone/:phone`
Busca por teléfono.

### `GET /patients/by-wa/:waPhone`
Busca por WhatsApp.

### `PATCH /patients/:id/notes`
Actualiza notas.

### `PATCH /patients/:id/contact`
Actualiza email y teléfono.

### `DELETE /patients/:id`
Elimina paciente.

---

## Doctors

### `POST /doctors`
```json
{
  "name": "Ana",
  "lastname": "García",
  "cedula": 12345678,
  "email": "ana@example.com",
  "phone": "+584141234567",
  "specialtyId": "spec-ortodoncia",
  "dailyLimit": 12
}
```

### `GET /doctors?specialtyId=&active=true`
Lista doctores (filtrable).

### `GET /doctors/:id`
Detalle.

---

## Appointments

### `POST /appointments`
Crea una cita (con validación de cupo y duplicados).

```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "date": "2026-08-21",
  "time": "10:00",
  "source": "web",
  "notes": "primera consulta"
}
```

### `GET /appointments?patientId=&doctorId=&status=&from=&to=`
Lista filtrable.

### `GET /appointments/:id`
Detalle.

### `PATCH /appointments/:id/cancel`
```json
{ "reason": "opcional" }
```

### `PATCH /appointments/:id/reschedule`
```json
{
  "newDate": "2026-08-22",
  "newTime": "11:30"
}
```

### `PATCH /appointments/:id/status`
```json
{ "status": "confirmed" }
```

Valores: `pending, confirmed, checked_in, completed, no_show, cancelled, expired`.

---

## Availability

### `GET /availability?doctorId=&date=YYYY-MM-DD`
Devuelve slots disponibles del doctor en la fecha.

```json
{
  "doctorId": "...",
  "date": "2026-08-21",
  "slots": [
    { "time": "08:00", "available": true },
    { "time": "08:30", "available": false },
    ...
  ],
  "capacity": { "limit": 12, "booked": 5, "remaining": 7 }
}
```

---

## Conversation (Agente)

### `POST /conversation/message`
Envía un mensaje al agente (procesa síncronamente).

```json
{
  "channel": "whatsapp",
  "externalId": "+584141234567",
  "text": "Quiero una cita",
  "conversationId": "opcional"
}
```

**Respuesta:**
```json
{ "ok": true, "reply": "¡Hola! ¿Para cuándo te gustaría?" }
```

### WebSocket: `/agent` (namespace)

Conectar y enviar mensajes con streaming de tokens:

```js
const ws = new WebSocket('ws://localhost:3000/agent');
ws.send(JSON.stringify({
  type: 'message',
  conversationId: 'opcional',
  text: 'Quiero cita mañana'
}));
// Recibe: { type: 'token', content: '...' } ...
//         { type: 'done' }
```

---

## Webhooks

### `POST /webhooks/payments`
Recibe eventos de Stripe o MercadoPago.

Headers esperados:
- Stripe: `stripe-signature: t=...,v1=...`
- MercadoPago: `x-signature: ...`

Body: payload JSON del provider.

---

## Health

### `GET /healthz`
Estado de BD, LLM y cola.

### `GET /readyz`
Listo.

### `GET /metrics`
Métricas Prometheus.

---

## Errores

Todos los errores siguen este formato:

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Patient with id xxx not found",
  "path": "/patients/xxx",
  "timestamp": "2026-08-20T22:00:00.000Z"
}
```

Códigos comunes:

| code | status | descripción |
|------|--------|-------------|
| NOT_FOUND | 404 | recurso no existe |
| VALIDATION_ERROR | 400 | Zod / class-validator falló |
| CONFLICT | 409 | duplicado, slot ocupado |
| BUSINESS_RULE_VIOLATION | 422 | FSM, cupo lleno, etc. |
| UNAUTHORIZED | 401 | falta token |
| FORBIDDEN | 403 | permisos insuficientes |
| TOOL_EXECUTION_ERROR | 500 | tool del agente falló |
| LLM_ERROR | 502 | provider LLM no responde |

---

## Rate limit

Por defecto: 30 req/min por IP. Configurable en `RATE_LIMIT_TTL` y
`RATE_LIMIT_MAX`.

Si se excede:
```json
{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }
```
