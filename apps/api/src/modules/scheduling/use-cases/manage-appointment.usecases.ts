import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { MedicalAppointment } from '../../../domain/scheduling/appointment.entity';
import {
  APPOINTMENT_REPOSITORY,
  IAppointmentRepository,
} from '../../../domain/scheduling/repositories';
import { AppointmentStatusVO } from '../../../domain/scheduling/appointment-status';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain.errors';
import { DateOnly, TimeOfDay } from '../../../domain/shared/value-objects';
import {
  AppointmentCancelledEvent,
  AppointmentRescheduledEvent,
} from '../../../domain/scheduling/events';

export const CancelAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().optional(),
});

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: IAppointmentRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(input: z.infer<typeof CancelAppointmentSchema>): Promise<MedicalAppointment> {
    const parsed = CancelAppointmentSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const appt = await this.repo.findById(parsed.data.appointmentId);
    if (!appt) throw new NotFoundError('Appointment', parsed.data.appointmentId);

    appt.changeStatus(AppointmentStatusVO.cancelled());
    if (parsed.data.reason) appt.addNotes(parsed.data.reason);
    await this.repo.save(appt);

    await this.publishEvent(
      new AppointmentCancelledEvent(appt.id, {
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        date: appt.date.value,
        time: appt.time.value,
        reason: parsed.data.reason,
      }),
    );

    return appt;
  }

  protected async publishEvent(event: any): Promise<void> {
    this.events.emitAsync(event.eventName, event);
  }
}

export const RescheduleAppointmentSchema = z.object({
  appointmentId: z.string().min(1),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

@Injectable()
export class RescheduleAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: IAppointmentRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(
    input: z.infer<typeof RescheduleAppointmentSchema>,
  ): Promise<MedicalAppointment> {
    const parsed = RescheduleAppointmentSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError('Invalid input');

    const appt = await this.repo.findById(parsed.data.appointmentId);
    if (!appt) throw new NotFoundError('Appointment', parsed.data.appointmentId);

    const conflict = await this.repo.findActiveSlot(
      appt.doctorId,
      parsed.data.newDate,
      parsed.data.newTime,
    );
    if (conflict && conflict.id !== appt.id) {
      throw new ValidationError('New slot is already taken');
    }

    const oldDate = appt.date.value;
    const oldTime = appt.time.value;

    appt.reschedule(DateOnly.create(parsed.data.newDate), TimeOfDay.create(parsed.data.newTime));
    await this.repo.save(appt);

    await this.publishEvent(
      new AppointmentRescheduledEvent(appt.id, {
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        oldDate,
        oldTime,
        newDate: appt.date.value,
        newTime: appt.time.value,
      }),
    );

    return appt;
  }

  protected async publishEvent(event: any): Promise<void> {
    this.events.emitAsync(event.eventName, event);
  }
}
