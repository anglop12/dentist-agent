import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Inject } from '@nestjs/common';
import { IAppointmentRepository, APPOINTMENT_REPOSITORY } from '../../domain/scheduling/repositories';
import { IPatientRepository, PATIENT_REPOSITORY } from '../../domain/identity/repositories';
import { IDoctorRepository, DOCTOR_REPOSITORY } from '../../domain/identity/repositories';
import { IJobQueue, JOB_QUEUE } from '../../domain/jobs/job-queue.port';
import {
  AppointmentCreatedEvent,
  AppointmentConfirmedEvent,
  AppointmentCancelledEvent,
  AppointmentRescheduledEvent,
  AppointmentStatusChangedEvent,
} from '../../domain/scheduling/events';
import { JOB_SEND_REMINDER_24H, JOB_SEND_REMINDER_2H, ReminderPayload } from '../../infrastructure/jobs/job-handlers';
import { ChannelFactory } from '../communication/channel.factory';
import { MetricsCollector } from '../../infrastructure/observability/metrics';
import { KpiCache } from '../../infrastructure/caching/kpi-cache';
import { OutputSanitizer } from '../../shared/security/output-sanitizer';
import { DB_TOKEN } from '../../infrastructure/database/database.tokens';
import { v7 as uuidv7 } from 'uuid';

/**
 * EventListeners - reacciona a eventos de dominio.
 *
 * Listeners implementados (ADR-010):
 *   1. PersistEventInLog       â†’ todo evento â†’ tabla event_log (auditorÃ­a)
 *   2. EnqueueReminders         â†’ AppointmentCreated â†’ jobs T-24h, T-2h
 *   3. SendWhatsAppConfirmation â†’ AppointmentCreated/Confirmed â†’ envÃ­a WA al paciente
 *   4. CancelReminders          â†’ AppointmentCancelled â†’ marca reminders como done
 *   5. UpdateKpiCache           â†’ cualquier cambio de cita â†’ invalida KPIs
 *   6. TrackNoShow              â†’ AppointmentStatusChanged â†’ no_show â†’ counter
 */
@Injectable()
export class EventListeners {
  private readonly logger = new Logger(EventListeners.name);

  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: IPatientRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
    @Inject(JOB_QUEUE) private readonly queue: IJobQueue,
    private readonly channelFactory: ChannelFactory,
    private readonly metrics: MetricsCollector,
    private readonly kpiCache: KpiCache,
    @Inject(DB_TOKEN) private readonly dbConn: any,
  ) {}

  /**
   * Persiste TODO evento de dominio en event_log (auditoría).
   */
  @OnEvent('*')
  async persistEventInLog(event: any): Promise<void> {
    if (!event?.eventName) return;
    try {
      const { eventLog } = await import('../../infrastructure/database/schema');
      await this.dbConn.db.insert(eventLog).values({
        id: uuidv7(),
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        payload: event.payload ?? {},
        occurredAt: event.occurredAt ?? new Date(),
        processed: false,
      });
    } catch (e) {
      this.logger.warn(`event_log persist failed: ${(e as Error).message}`);
    }
  }

  /**
   * Cuando se crea una cita: encola recordatorios T-24h y T-2h,
   * envÃ­a WhatsApp de confirmaciÃ³n e incrementa counter.
   */
  @OnEvent('AppointmentCreated')
  async onAppointmentCreated(event: AppointmentCreatedEvent): Promise<void> {
    this.metrics.appointmentsCreated.inc({ source: event.payload.source });

    const appointmentId = event.aggregateId;
    const dateTime = new Date(`${event.payload.date}T${event.payload.time}:00.000Z`);

    // Recordatorios
    const reminder24h = new Date(dateTime.getTime() - 24 * 60 * 60_000);
    const reminder2h = new Date(dateTime.getTime() - 2 * 60 * 60_000);

    if (reminder24h.getTime() > Date.now()) {
      await this.queue.enqueue(
        JOB_SEND_REMINDER_24H,
        { appointmentId } as ReminderPayload,
        {
          runAt: reminder24h,
          idempotencyKey: `reminder-24h:${appointmentId}`,
        },
      );
    }
    if (reminder2h.getTime() > Date.now()) {
      await this.queue.enqueue(
        JOB_SEND_REMINDER_2H,
        { appointmentId } as ReminderPayload,
        {
          runAt: reminder2h,
          idempotencyKey: `reminder-2h:${appointmentId}`,
        },
      );
    }

    // ConfirmaciÃ³n WhatsApp
    await this.sendWhatsAppConfirmation(
      event.payload.patientId,
      `Hola! Tu cita quedÃ³ agendada para el ${event.payload.date} a las ${event.payload.time}. Te enviaremos un recordatorio.`,
    );

    // Invalidar cachÃ© de KPIs
    await this.kpiCache.invalidate('appointments_total');
    await this.kpiCache.invalidate('appointments_by_status');
  }

  @OnEvent('AppointmentConfirmed')
  async onAppointmentConfirmed(event: AppointmentConfirmedEvent): Promise<void> {
    const patient = await this.patientRepo.findById(event.payload.patientId);
    if (!patient) return;
    await this.sendWhatsAppConfirmation(
      event.payload.patientId,
      `âœ… Tu cita del ${event.payload.date} ${event.payload.time} ha sido confirmada.`,
    );
  }

  @OnEvent('AppointmentCancelled')
  async onAppointmentCancelled(event: AppointmentCancelledEvent): Promise<void> {
    await this.sendWhatsAppConfirmation(
      event.payload.patientId,
      `Tu cita del ${event.payload.date} ${event.payload.time} fue cancelada. ${
        event.payload.reason ? `Motivo: ${event.payload.reason}.` : ''
      }Si necesitas reprogramar, escrÃ­beme.`,
    );
    // Marcar recordatorios como done (idempotencia: encolar un job "noop")
    // AquÃ­ podrÃ­amos cancelarlos realmente si la cola lo soportase; por ahora
    // el handler ya valida que la cita no estÃ© cancelada antes de enviar.
    await this.kpiCache.invalidate('appointments_total');
    await this.kpiCache.invalidate('appointments_by_status');
  }

  @OnEvent('AppointmentRescheduled')
  async onAppointmentRescheduled(event: AppointmentRescheduledEvent): Promise<void> {
    await this.sendWhatsAppConfirmation(
      event.payload.patientId,
      `Tu cita fue reagendada para el ${event.payload.newDate} a las ${event.payload.newTime}.`,
    );
  }

  @OnEvent('AppointmentStatusChanged')
  async onStatusChanged(event: AppointmentStatusChangedEvent): Promise<void> {
    if (event.payload.to === 'no_show') {
      this.metrics.appointmentsNoShow.inc();
    }
    await this.kpiCache.invalidate('appointments_by_status');
  }

  private async sendWhatsAppConfirmation(patientId: string, text: string): Promise<void> {
    try {
      const patient = await this.patientRepo.findById(patientId);
      if (!patient) return;

      const sanitized = OutputSanitizer.sanitize(text);
      if (!sanitized.ok) {
        this.logger.warn(`Skipping WA send: unsafe text (${sanitized.reason})`);
        return;
      }

      const channel = this.channelFactory.get('whatsapp');
      if (!channel) {
        this.logger.warn('WhatsApp channel not available');
        return;
      }
      const idempotencyKey = `wa-confirm:${patientId}:${Date.now()}`;
      await channel.send(patient.waPhone.value, {
        text: sanitized.text,
        replyTo: idempotencyKey,
      });
    } catch (e) {
      this.logger.error(`WA send failed: ${(e as Error).message}`);
    }
  }
}
