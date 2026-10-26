# Tools del Agente

> Catálogo completo de tools registradas en `apps/api/src/modules/conversation/tools/`.

Cada tool sigue el contrato:

```ts
{
  name: string;          // nombre único
  description: string;   // descripción semántica (para el LLM)
  inputSchema: ZodSchema;// validación de entrada
  requiredPermissions: string[];
  execute(input, ctx): Promise<result>;
}
```

---

## Tools iniciales

### `identify_patient`

Busca un paciente existente por teléfono, email o cédula. Si no existe y
`createIfMissing=true`, lo registra.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| phone | string? | E.164 |
| waPhone | string? | E.164 |
| email | string? | email |
| cedula | number? | cédula |
| createIfMissing | boolean | si true y no existe, lo crea |
| name, lastname, birthdate, address, gender | requeridos si createIfMissing=true |

**Permisos:** `read:patients`

**Retorno (anonimizado para LLM):**
```ts
{ found: true, patientId, firstName, cedula: '***1234' }
```

---

### `list_doctors`

Lista doctores activos, opcionalmente filtrados por especialidad.

| Campo | Tipo | Default |
|-------|------|---------|
| specialtyId | string? | — |
| activeOnly | boolean | true |

**Permisos:** `read:doctors`

**Retorno:**
```ts
[{ doctorId, firstName, lastName, specialtyId, dailyLimit }, ...]
```

---

### `check_availability`

Devuelve slots disponibles de un doctor en una fecha.

| Campo | Tipo | Validación |
|-------|------|------------|
| doctorId | string | required |
| date | string | YYYY-MM-DD |

**Permisos:** `read:availability`

**Retorno:**
```ts
{
  doctorId, date,
  availableSlots: ['09:00', '09:30', ...],
  capacity: { limit: 12, booked: 5, remaining: 7 }
}
```

---

### `propose_slots`

Presenta una lista corta de slots tentativos al paciente (TTL 10 min).
Persiste en `conversations.context.proposedSlots`.

**Permisos:** `write:availability`

---

### `create_appointment`

Crea una cita. Valida:
- Paciente y doctor existen
- No hay cita activa en ese slot (índice único)
- Doctor tiene cupo diario disponible

| Campo | Tipo | Validación |
|-------|------|------------|
| patientId | string | UUID |
| doctorId | string | UUID |
| date | string | YYYY-MM-DD |
| time | string | HH:MM |
| notes | string? | — |

**Permisos:** `write:appointments`

**Efectos secundarios:**
- Crea registro en `medical_appointments`
- Encola recordatorios T-24h y T-2h (job queue)
- Publica `AppointmentCreatedEvent`

---

### `reschedule_appointment`

Cambia fecha/hora de una cita existente.

| Campo | Tipo |
|-------|------|
| appointmentId | string |
| newDate | YYYY-MM-DD |
| newTime | HH:MM |

**Permisos:** `write:appointments`

---

### `cancel_appointment`

Cancela una cita. Cambia estado a `cancelled` vía FSM.

| Campo | Tipo |
|-------|------|
| appointmentId | string |
| reason | string? |

**Permisos:** `write:appointments`

---

### `send_message`

Envía un mensaje al paciente por el canal configurado.

| Campo | Tipo |
|-------|------|
| to | string (phone o chatId) |
| text | string (max 4096) |

**Permisos:** `write:channel`

---

### `send_payment_link` (opcional, F4)

Genera link de pago (Stripe / MercadoPago) para anticipo de la cita.

**Permisos:** `write:payments`

---

## Guardarraíles FSM

La FSM de conversación restringe qué tools puede invocar el agente en cada estado:

| Estado                    | Tools permitidas                              |
|---------------------------|-----------------------------------------------|
| `greeting`                | identify_patient, send_message, list_doctors |
| `identifying_patient`     | identify_patient, send_message                |
| `collecting_intent`       | list_doctors, check_availability, send_message |
| `collecting_specialty`    | list_doctors, send_message                   |
| `collecting_doctor`       | list_doctors, send_message                   |
| `showing_slots`           | propose_slots, send_message, check_availability |
| `awaiting_slot_choice`    | propose_slots, create_appointment, send_message |
| `awaiting_payment`        | send_payment_link, send_message              |
| `confirming_appointment`  | create_appointment, send_message, reschedule_appointment |
| `awaiting_reschedule_choice` | check_availability, propose_slots, send_message |
| `idle`                    | identify_patient, send_message, list_doctors  |
| `closed`                  | (ninguna)                                    |

Si el LLM propone una tool no permitida, el `AgentService` la rechaza
y emite un reply pidiendo más información.

---

## Cómo añadir una nueva tool

1. Crear archivo en `apps/api/src/modules/conversation/tools/<name>.tool.ts`
2. Definir Zod schema de input
3. Implementar `execute(input, ctx)` con la lógica
4. Registrar en `AgentService.onModuleInit()`:
   ```ts
   this.tools.register(MyNewTool);
   ```
5. Si el estado donde se usa no la permite, actualizar `ALLOWED_TOOLS` en
   `apps/api/src/domain/conversation/conversation-fsm.ts`
6. Añadir test e2e

---

## Compliance: sin PHI al LLM

Las tools que devuelven datos de paciente al LLM usan versiones anonimizadas:

- `patient.name.name` → solo firstName
- `patient.cedula.value` → `***` + últimos 4 dígitos
- `patient.email`, `patient.phone`, `patient.notes` → **NUNCA** al LLM

La entidad `Patient.anonymized()` centraliza esta lógica.
