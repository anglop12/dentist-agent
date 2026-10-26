import { Inject, Injectable } from '@nestjs/common';
import {
  APPOINTMENT_REPOSITORY,
  IAppointmentRepository,
  AppointmentFilter,
} from '../../../domain/scheduling/repositories';
import { MedicalAppointment } from '../../../domain/scheduling/appointment.entity';
import { DateOnly } from '../../../domain/shared/value-objects';

@Injectable()
export class GetAppointmentUseCase {
  constructor(@Inject(APPOINTMENT_REPOSITORY) private readonly repo: IAppointmentRepository) {}

  async byId(id: string): Promise<MedicalAppointment | null> {
    return this.repo.findById(id);
  }

  async list(
    filter: AppointmentFilter,
    opts?: { limit?: number; offset?: number },
  ): Promise<MedicalAppointment[]> {
    return this.repo.findMany(filter, opts);
  }

  async upcomingByPatient(patientId: string): Promise<MedicalAppointment[]> {
    return this.repo.findMany(
      { patientId, from: DateOnly.today() },
      { limit: 50, offset: 0 },
    );
  }

  async upcomingByDoctor(doctorId: string): Promise<MedicalAppointment[]> {
    return this.repo.findMany(
      { doctorId, from: DateOnly.today() },
      { limit: 50, offset: 0 },
    );
  }
}
