import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

/**
 * Pacientes - una sola entidad, sin tipos ni categorías heredadas.
 * Se eliminó type_person, typePersonCode, titularId, userId.
 */
export const patients = sqliteTable(
  'patients',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    lastname: text('lastname').notNull(),
    age: integer('age').notNull(),
    cedula: integer('cedula').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    waPhone: text('wa_phone').notNull(),
    birthdate: integer('birthdate', { mode: 'timestamp' }).notNull(),
    address: text('address').notNull(),
    gender: integer('gender').notNull(),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    cedulaUq: uniqueIndex('patients_cedula_uq').on(t.cedula),
    emailUq: uniqueIndex('patients_email_uq').on(t.email),
    waPhoneUq: uniqueIndex('patients_wa_phone_uq').on(t.waPhone),
    phoneIdx: index('patients_phone_idx').on(t.phone),
  }),
);

export const specialties = sqliteTable(
  'specialties',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    nameUq: uniqueIndex('specialties_name_uq').on(t.name),
  }),
);

export const doctors = sqliteTable(
  'doctors',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    lastname: text('lastname').notNull(),
    cedula: integer('cedula').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    specialtyId: text('specialty_id')
      .notNull()
      .references(() => specialties.id),
    dailyLimit: integer('daily_limit'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    cedulaUq: uniqueIndex('doctors_cedula_uq').on(t.cedula),
    emailUq: uniqueIndex('doctors_email_uq').on(t.email),
    specialtyIdx: index('doctors_specialty_idx').on(t.specialtyId),
  }),
);

/** Estados de la cita. Tabla de catálogo (referenciada por FK lógica). */
export const statusMedicalAppointments = sqliteTable('status_medical_appointments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Citas médicas - estado como TEXT (no FK) para mantener flexibilidad
 * de la FSM y poder añadir/quitar estados sin migraciones.
 */
export const medicalAppointments = sqliteTable(
  'medical_appointments',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    doctorId: text('doctor_id')
      .notNull()
      .references(() => doctors.id),
    statusCode: text('status_code').notNull().default('pending'),
    date: text('date').notNull(), // YYYY-MM-DD
    time: text('time').notNull(), // HH:MM
    source: text('source').notNull().default('web'),
    conversationId: text('conversation_id'),
    paymentIntentId: text('payment_intent_id'),
    depositAmount: integer('deposit_amount'),
    idempotencyKey: text('idempotency_key'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    slotUq: uniqueIndex('appt_doctor_date_time_uq').on(t.doctorId, t.date, t.time),
    idempotencyUq: uniqueIndex('appt_idempotency_uq').on(t.idempotencyKey),
    patientIdx: index('appt_patient_idx').on(t.patientId),
    doctorDateIdx: index('appt_doctor_date_idx').on(t.doctorId, t.date),
    statusIdx: index('appt_status_idx').on(t.statusCode),
    convIdx: index('appt_conv_idx').on(t.conversationId),
  }),
);

/** Conversaciones del agente IA - una por external_id + channel. */
export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    channel: text('channel').notNull(),
    externalId: text('external_id').notNull(),
    state: text('state').notNull().default('greeting'),
    context: text('context', { mode: 'json' }).notNull(),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    channelExternalUq: uniqueIndex('conv_channel_external_uq').on(t.channel, t.externalId),
    stateIdx: index('conv_state_idx').on(t.state),
  }),
);

/** Mensajes del agente (auditoría + memoria). */
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    toolName: text('tool_name'),
    toolResult: text('tool_result', { mode: 'json' }),
    tokens: integer('tokens'),
    at: integer('at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    convIdx: index('msg_conv_idx').on(t.conversationId),
    atIdx: index('msg_at_idx').on(t.at),
  }),
);

/** Cola de jobs en SQLite (cron interno, sin Redis). */
export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    runAt: integer('run_at', { mode: 'timestamp' }).notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastError: text('last_error'),
    idempotencyKey: text('idempotency_key'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    statusRunAtIdx: index('jobs_status_run_at_idx').on(t.status, t.runAt),
    nameIdx: index('jobs_name_idx').on(t.name),
    idempotencyUq: uniqueIndex('jobs_idempotency_uq').on(t.idempotencyKey),
  }),
);

/** Log de auditoría para acciones sensibles. */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    resource: text('resource').notNull(),
    resourceId: text('resource_id'),
    payload: text('payload', { mode: 'json' }),
    at: integer('at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    actorIdx: index('audit_actor_idx').on(t.actor),
    resourceIdx: index('audit_resource_idx').on(t.resource, t.resourceId),
    atIdx: index('audit_at_idx').on(t.at),
  }),
);

/** Log de eventos de dominio (para event-sourcing light / replay). */
export const eventLog = sqliteTable(
  'event_log',
  {
    id: text('id').primaryKey(),
    eventName: text('event_name').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    payload: text('payload', { mode: 'json' }).notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
    processed: integer('processed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => ({
    nameIdx: index('event_name_idx').on(t.eventName),
    aggIdx: index('event_agg_idx').on(t.aggregateId),
    processedIdx: index('event_processed_idx').on(t.processed),
  }),
);

/** Caché de KPIs (invalidada por eventos de dominio). */
export const kpiCache = sqliteTable('kpi_cache', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  computedAt: integer('computed_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
}, (t) => ({
  expiresIdx: index('kpi_expires_idx').on(t.expiresAt),
}));
