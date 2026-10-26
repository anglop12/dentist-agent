import { Inject, Injectable, Logger } from '@nestjs/common';
import { IJobQueue, JOB_QUEUE } from '../../domain/jobs/job-queue.port';
import { IPatientRepository, PATIENT_REPOSITORY } from '../../domain/identity/repositories';
import { IDoctorRepository, DOCTOR_REPOSITORY } from '../../domain/identity/repositories';
import { IAppointmentRepository, APPOINTMENT_REPOSITORY } from '../../domain/scheduling/repositories';
import { ChannelFactory } from './channel.factory';
import { OutputSanitizer } from '../../shared/security/output-sanitizer';

export const JOB_SEND_REMINDER_24H = 'send_reminder_24h';
export const JOB_SEND_REMINDER_2H = 'send_reminder_2h';
export const JOB_CANCEL_NO_SHOW = 'cancel_no_show';

export interface ReminderPayload {
  appointmentId: string;
}

/**
 * ReminderDispatcher - encapsula la lÃ³gica de envÃ­o de recordatorios
 * y la cancelaciÃ³n de no-shows. Usado por el worker.
 */
@Injectable()
export class ReminderDispatcher {
  private readonly logger = new Logger(ReminderDispatcher.name);

  constructor(
    @Inject(JOB_QUEUE) private readonly queue: IJobQueue,
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: IPatientRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
    private readonly channelFactory: ChannelFactory,
  ) {}

  /**
   * Encola recordatorios para una cita reciÃ©n creada.
   * Llamar desde un listener de AppointmentCreated o desde el use case.
   */
  async enqueueReminders(appointmentId: string, date: string, time: string): Promise<void> {
    const appointmentDate = new Date(`${date}T${time}:00.000Z`);
    const reminder24h = new Date(appointmentDate.getTime() - 24 * 60 * 60_000);
    const reminder2h = new Date(appointmentDate.getTime() - 2 * 60 * 60_000);
    const noShowAt = new Date(appointmentDate.getTime() + 30 * 60_000);

    const payload: ReminderPayload = { appointmentId };

    if (reminder24h.getTime() > Date.now()) {
      await this.queue.enqueue(JOB_SEND_REMINDER_24H, payload, {
        runAt: reminder24h,
        idempotencyKey: `reminder-24h:${appointmentId}`,
      });
    }
    if (reminder2h.getTime() > Date.now()) {
      await this.queue.enqueue(JOB_SEND_REMINDER_2H, payload, {
        runAt: reminder2h,
        idempotencyKey: `reminder-2h:${appointmentId}`,
      });
    }
    await this.queue.enqueue(JOB_CANCEL_NO_SHOW, payload, {
      runAt: noShowAt,
      idempotencyKey: `no-show:${appointmentId}`,
    });
  }

  /** Handler de job T-24h. */
  async runReminder24h(payload: ReminderPayload): Promise<void> {
    const appt = await this.apptRepo.findById(payload.appointmentId);
    if (!appt || !['pending', 'confirmed'].includes(appt.status.value)) return;
    const patient = await this.patientRepo.findById(appt.patientId);
    const doctor = await this.doctorRepo.findById(appt.doctorId);
    if (!patient || !doctor) return;
    await this.sendToPatient(
      patient.waPhone.value,
      `Hola ${patient.name.name}, te recordamos tu cita el ${appt.date.value} a las ${appt.time.value} con ${doctor.name.full}. Responde "OK" para confirmar o "CANCELAR" para anular.`,
    );
  }

  /** Handler de job T-2h. */
  async runReminder2h(payload: ReminderPayload): Promise<void> {
    const appt = await this.apptRepo.findById(payload.appointmentId);
    if (!appt || !['pending', 'confirmed'].includes(appt.status.value)) return;
    const patient = await this.patientRepo.findById(appt.patientId);
    if (!patient) return;
    await this.sendToPatient(
      patient.waPhone.value,
      `â° ${patient.name.name}, tu cita es en 2 horas (${appt.time.value}). Te esperamos.`,
    );
  }

  /**
   * Handler de job "no-show".
   * No marca automÃ¡ticamente como no_show (decisiÃ³n humana), solo notifica.
   */
  async runCancelNoShow(payload: ReminderPayload): Promise<void> {
    const appt = await this.apptRepo.findById(payload.appointmentId);
    if (!appt) return;
    if (!['pending', 'confirmed'].includes(appt.status.value)) return;
    this.logger.warn(`[no_show] appointment=${appt.id} not attended â€” requires manual review`);
    // En producciÃ³n: enviar alerta al consultorio vÃ­a canal interno / webhook.
  }

  private async sendToPatient(to: string, text: string): Promise<void> {
    const sanitized = OutputSanitizer.sanitize(text);
    if (!sanitized.ok) {
      this.logger.warn(`Skipping reminder: unsafe text (${sanitized.reason})`);
      return;
    }
    const channel = this.channelFactory.get('whatsapp');
    if (!channel) {
      this.logger.warn('WhatsApp channel not available');
      return;
    }
    await channel.send(to, { text: sanitized.text });
  }
}
