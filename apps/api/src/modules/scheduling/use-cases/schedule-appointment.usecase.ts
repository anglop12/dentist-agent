import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { MedicalAppointment } from '../../../domain/scheduling/appointment.entity';
import {
  APPOINTMENT_REPOSITORY,
  IAppointmentRepository,
} from '../../../domain/scheduling/repositories';
import {
  IPatientRepository,
  PATIENT_REPOSITORY,
} from '../../../domain/identity/repositories';
import {
  IDoctorRepository,
  DOCTOR_REPOSITORY,
} from '../../../domain/identity/repositories';
import { Id } from '../../../shared/utils/id.util';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/domain.errors';
import { IClock, CLOCK } from '../../../shared/utils/clock.util';
import {
  AppointmentCreatedEvent,
} from '../../../domain/scheduling/events';

export const ScheduleAppointmentSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  source: z.enum(['web', 'whatsapp', 'agent', 'phone', 'in_person']).default('web'),
  conversationId: z.string().optional(),
  notes: z.string().optional(),
});

export type ScheduleAppointmentInput = z.infer<typeof ScheduleAppointmentSchema>;

/**
 * Use case principal - crea una cita validando:
 * - Paciente y doctor existen
 * - No hay cita activa en ese slot
 * - Doctor tiene cupo disponible ese día
 */
@Injectable()
export class ScheduleAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepo: IPatientRepository,
    @Inject(DOCTOR_REPOSITORY) private readonly doctorRepo: IDoctorRepository,
    @Inject(CLOCK) private readonly clock: IClock,
    private readonly events: EventEmitter2,
  ) {}

  async execute(input: ScheduleAppointmentInput): Promise<MedicalAppointment> {
    const parsed = ScheduleAppointmentSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid appointment data', this.formatIssues(parsed.error));
    }
    const data = parsed.data;

    const [patient, doctor] = await Promise.all([
      this.patientRepo.findById(data.patientId),
      this.doctorRepo.findById(data.doctorId),
    ]);
    if (!patient) throw new NotFoundError('Patient', data.patientId);
    if (!doctor) throw new NotFoundError('Doctor', data.doctorId);
    if (!doctor.active) throw new BusinessRuleError('Doctor is inactive');

    // Anti-duplicado: el índice único lo garantiza, pero validamos para error legible.
    const existing = await this.apptRepo.findActiveSlot(data.doctorId, data.date, data.time);
    if (existing) {
      throw new ConflictError(`Slot ${data.date} ${data.time} already taken for this doctor`);
    }

    // Validar cupo diario
    if (doctor.dailyLimit !== null) {
      const booked = await this.apptRepo.countActiveByDoctorAndDate(data.doctorId, data.date);
      if (booked >= doctor.dailyLimit) {
        throw new BusinessRuleError(
          `Doctor has reached daily limit (${booked}/${doctor.dailyLimit}) on ${data.date}`,
        );
      }
    }

    const appt = MedicalAppointment.create({
      id: Id.new(),
      patientId: data.patientId,
      doctorId: data.doctorId,
      date: data.date,
      time: data.time,
      source: data.source,
      conversationId: data.conversationId,
      notes: data.notes,
    });
    await this.apptRepo.save(appt);

    // Domain event (in-process listeners reaccionarán).
    await this.publishEvent(
      new AppointmentCreatedEvent(appt.id, {
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        date: appt.date.value,
        time: appt.time.value,
        source: appt.source,
      }),
    );

    return appt;
  }

  protected async publishEvent(event: any): Promise<void> {
    this.events.emitAsync(event.eventName, event);
  }

  private formatIssues(err: z.ZodError) {
    return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  }
}
