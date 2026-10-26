-- Migración inicial: Agente Odontológico IA
-- Generada manualmente desde apps/api/src/infrastructure/database/schema/index.ts
-- Reemplaza al placeholder. Regenerable con: pnpm db:generate

-- ============================================================================
-- SPECIALTIES
-- ============================================================================
CREATE TABLE `specialties` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `specialties_name_uq` ON `specialties` (`name`);
--> statement-breakpoint

-- ============================================================================
-- STATUS_MEDICAL_APPOINTMENTS (catálogo de estados)
-- ============================================================================
CREATE TABLE `status_medical_appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

-- ============================================================================
-- PATIENTS (una sola entidad, sin tipos ni categorías)
-- ============================================================================
CREATE TABLE `patients` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `lastname` text NOT NULL,
  `age` integer NOT NULL,
  `cedula` integer NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `wa_phone` text NOT NULL,
  `birthdate` integer NOT NULL,
  `address` text NOT NULL,
  `gender` integer NOT NULL,
  `notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_cedula_uq` ON `patients` (`cedula`);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_email_uq` ON `patients` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_wa_phone_uq` ON `patients` (`wa_phone`);
--> statement-breakpoint
CREATE INDEX `patients_phone_idx` ON `patients` (`phone`);
--> statement-breakpoint

-- ============================================================================
-- DOCTORS
-- ============================================================================
CREATE TABLE `doctors` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `lastname` text NOT NULL,
  `cedula` integer NOT NULL,
  `email` text NOT NULL,
  `phone` text NOT NULL,
  `specialty_id` text NOT NULL,
  `daily_limit` integer,
  `active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_cedula_uq` ON `doctors` (`cedula`);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_email_uq` ON `doctors` (`email`);
--> statement-breakpoint
CREATE INDEX `doctors_specialty_idx` ON `doctors` (`specialty_id`);
--> statement-breakpoint

-- ============================================================================
-- MEDICAL_APPOINTMENTS
-- ============================================================================
CREATE TABLE `medical_appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `patient_id` text NOT NULL,
  `doctor_id` text NOT NULL,
  `status_code` text DEFAULT 'pending' NOT NULL,
  `date` text NOT NULL,
  `time` text NOT NULL,
  `source` text DEFAULT 'web' NOT NULL,
  `conversation_id` text,
  `payment_intent_id` text,
  `deposit_amount` integer,
  `idempotency_key` text,
  `notes` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appt_doctor_date_time_uq` ON `medical_appointments` (`doctor_id`, `date`, `time`);
--> statement-breakpoint
CREATE UNIQUE INDEX `appt_idempotency_uq` ON `medical_appointments` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `appt_patient_idx` ON `medical_appointments` (`patient_id`);
--> statement-breakpoint
CREATE INDEX `appt_doctor_date_idx` ON `medical_appointments` (`doctor_id`, `date`);
--> statement-breakpoint
CREATE INDEX `appt_status_idx` ON `medical_appointments` (`status_code`);
--> statement-breakpoint
CREATE INDEX `appt_conv_idx` ON `medical_appointments` (`conversation_id`);
--> statement-breakpoint

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================
CREATE TABLE `conversations` (
  `id` text PRIMARY KEY NOT NULL,
  `channel` text NOT NULL,
  `external_id` text NOT NULL,
  `state` text DEFAULT 'greeting' NOT NULL,
  `context` text NOT NULL,
  `metadata` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conv_channel_external_uq` ON `conversations` (`channel`, `external_id`);
--> statement-breakpoint
CREATE INDEX `conv_state_idx` ON `conversations` (`state`);
--> statement-breakpoint

-- ============================================================================
-- MESSAGES
-- ============================================================================
CREATE TABLE `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `conversation_id` text NOT NULL,
  `role` text NOT NULL,
  `content` text NOT NULL,
  `tool_name` text,
  `tool_result` text,
  `tokens` integer,
  `at` integer NOT NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `msg_conv_idx` ON `messages` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `msg_at_idx` ON `messages` (`at`);
--> statement-breakpoint

-- ============================================================================
-- JOBS (cola de recordatorios, etc.)
-- ============================================================================
CREATE TABLE `jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `run_at` integer NOT NULL,
  `payload` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `max_attempts` integer DEFAULT 3 NOT NULL,
  `last_error` text,
  `idempotency_key` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_run_at_idx` ON `jobs` (`status`, `run_at`);
--> statement-breakpoint
CREATE INDEX `jobs_name_idx` ON `jobs` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_uq` ON `jobs` (`idempotency_key`);
--> statement-breakpoint

-- ============================================================================
-- AUDIT_LOG
-- ============================================================================
CREATE TABLE `audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `actor` text NOT NULL,
  `action` text NOT NULL,
  `resource` text NOT NULL,
  `resource_id` text,
  `payload` text,
  `at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_log` (`actor`);
--> statement-breakpoint
CREATE INDEX `audit_resource_idx` ON `audit_log` (`resource`, `resource_id`);
--> statement-breakpoint
CREATE INDEX `audit_at_idx` ON `audit_log` (`at`);
--> statement-breakpoint

-- ============================================================================
-- EVENT_LOG (event sourcing light)
-- ============================================================================
CREATE TABLE `event_log` (
  `id` text PRIMARY KEY NOT NULL,
  `event_name` text NOT NULL,
  `aggregate_id` text NOT NULL,
  `payload` text NOT NULL,
  `occurred_at` integer NOT NULL,
  `processed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_name_idx` ON `event_log` (`event_name`);
--> statement-breakpoint
CREATE INDEX `event_agg_idx` ON `event_log` (`aggregate_id`);
--> statement-breakpoint
CREATE INDEX `event_processed_idx` ON `event_log` (`processed`);
--> statement-breakpoint

-- ============================================================================
-- KPI_CACHE (caché de métricas, invalidada por eventos)
-- ============================================================================
CREATE TABLE `kpi_cache` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `computed_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kpi_expires_idx` ON `kpi_cache` (`expires_at`);
