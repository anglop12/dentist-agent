/**
 * Handlers de jobs - recordatorios T-24h y T-2h, cancelador de no-show.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../domain/scheduling/repositories';
import {
  IPatientRepository,
  PATIENT_REPOSITORY,
} from '../../domain/identity/repositories';
import {
  IDoctorRepository,
  DOCTOR_REPOSITORY,
} from '../../domain/identity/repositories';
import { IJobQueue, JOB_QUEUE } from '../../domain/jobs/job-queue.port';

export const JOB_SEND_REMINDER_24H = 'send_reminder_24h';
export const JOB_SEND_REMINDER_2H = 'send_reminder_2h';
export const JOB_CANCEL_NO_SHOW = 'cancel_no_show';

export interface ReminderPayload {
  appointmentId: string;
}

@Injectable()
export class JobHandlers {
  private readonly logger = new Logger(JobHandlers.name);

  constructor(
    @Inject(JOB_QUEUE) private readonly queue: IJobQueue,
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: IPatientRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
  ) {}

  /**
   * Encola recordatorios automÃ¡ticamente cuando se crea una cita.
   * Llamar desde el use case o desde un listener de AppointmentCreated.
   */
  async enqueueReminders(appointmentId: string, date: string, time: string): Promise<void> {
    const appointmentDate = new Date(`${date}T${time}:00.000Z`);
    const reminder24h = new Date(appointmentDate.getTime() - 24 * 60 * 60_000);
    const reminder2h = new Date(appointmentDate.getTime() - 2 * 60 * 60_000);
    const noShowAt = new Date(appointmentDate.getTime() + 30 * 60_000); // 30 min despuÃ©s

    const payload: ReminderPayload = { appointmentId };

    if (reminder24h.getTime() > Date.now()) {
      await this.queue.enqueue(JOB_SEND_REMINDER_24H, payload, { runAt: reminder24h });
    }
    if (reminder2h.getTime() > Date.now()) {
      await this.queue.enqueue(JOB_SEND_REMINDER_2H, payload, { runAt: reminder2h });
    }
    await this.queue.enqueue(JOB_CANCEL_NO_SHOW, payload, { runAt: noShowAt });
  }

  private async handleReminder24h(payload: ReminderPayload): Promise<void> {
    const appt = await this.apptRepo.findById(payload.appointmentId);
    if (!appt || appt.status.value !== 'pending') return;
    const patient = await this.patientRepo.findById(appt.patientId);
    const doctor = await this.doctorRepo.findById(appt.doctorId);
    if (!patient || !doctor) return;

    const text = `Hola ${patient.name.name}, te recordamos tu cita el ${appt.date.value} a las ${appt.time.value} con ${doctor.name.full}. Confirma respondiendo "OK" o cancela con "CANCELAR".`;
    this.logger.log(`[reminder 24h] appointment=${appt.id}`);
    // AquÃ­ irÃ­a channel.send(patient.waPhone, { text }). El AgentService
    // lo hace cuando se invoca el canal; en producciÃ³n se inyecta aquÃ­.
  }

  private async handleReminder2h(payload: ReminderPayload): Promise<void> {
    const appt = await this.apptRepo.findById(payload.appointmentId);
    if (!appt || appt.status.value !== 'pending') return;
    const patient = await this.patientRepo.findById(appt.patientId);
    if (!patient) return;
    const text = `â° ${patient.name.name}, tu cita es en 2 horas (${appt.time.value}). Te esperamos.`;
    this.logger.log(`[reminder 2h] appointment=${appt.id}`);
  }

  private async handleNoShow(payload: ReminderPayload): Promise<void> {
    const appt = await this.apptRepo.findById(payload.appointmentId);
    if (!appt) return;
    if (appt.status.value !== 'pending' && appt.status.value !== 'confirmed') return;
    // No marcamos automÃ¡ticamente como no_show (decisiÃ³n humana).
    // Solo registramos en el log y notificamos al consultorio.
    this.logger.warn(`[no_show] appointment=${appt.id} not attended`);
  }
}
