import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MedicalAppointment } from '../../../domain/scheduling/appointment.entity';
import { APPOINTMENT_REPOSITORY, IAppointmentRepository } from '../../../domain/scheduling/repositories';
import { AppointmentStatusVO } from '../../../domain/scheduling/appointment-status';
import { NotFoundError, BusinessRuleError } from '../../../shared/errors/domain.errors';
import {
  AppointmentStatusChangedEvent,
} from '../../../domain/scheduling/events';

@Injectable()
export class ChangeAppointmentStatusUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly repo: IAppointmentRepository,
    private readonly events: EventEmitter2,
  ) {}

  async execute(appointmentId: string, to: string): Promise<MedicalAppointment> {
    const appt = await this.repo.findById(appointmentId);
    if (!appt) throw new NotFoundError('Appointment', appointmentId);

    const next = AppointmentStatusVO.create(to);
    if (appt.status.equals(next)) return appt;

    const from = appt.status.value;
    try {
      appt.changeStatus(next);
    } catch (e) {
      throw new BusinessRuleError((e as Error).message);
    }
    await this.repo.save(appt);

    await this.publishEvent(
      new AppointmentStatusChangedEvent(appt.id, {
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        from,
        to: appt.status.value,
      }),
    );

    return appt;
  }

  protected async publishEvent(event: any): Promise<void> {
    this.events.emitAsync(event.eventName, event);
  }
}
