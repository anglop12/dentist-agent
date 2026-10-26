import { Module } from '@nestjs/common';
import { AppointmentController } from './appointment.controller';
import { ScheduleAppointmentUseCase } from './use-cases/schedule-appointment.usecase';
import {
  CancelAppointmentUseCase,
  RescheduleAppointmentUseCase,
} from './use-cases/manage-appointment.usecases';
import { GetAppointmentUseCase } from './use-cases/get-appointment.usecase';
import { ChangeAppointmentStatusUseCase } from './use-cases/change-status.usecase';
import { APPOINTMENT_REPOSITORY } from '../../domain/scheduling/repositories';
import { SqliteAppointmentRepository } from '../../infrastructure/database/repositories/sqlite-appointment.repository';
import { PATIENT_REPOSITORY, DOCTOR_REPOSITORY } from '../../domain/identity/repositories';
import { IdentityModule } from '../identity/identity.module';
import { SystemClock, CLOCK } from '../../shared/utils/clock.util';

@Module({
  imports: [IdentityModule],
  controllers: [AppointmentController],
  providers: [
    ScheduleAppointmentUseCase,
    CancelAppointmentUseCase,
    RescheduleAppointmentUseCase,
    GetAppointmentUseCase,
    ChangeAppointmentStatusUseCase,
    { provide: APPOINTMENT_REPOSITORY, useClass: SqliteAppointmentRepository },
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [
    APPOINTMENT_REPOSITORY,
    ScheduleAppointmentUseCase,
    CancelAppointmentUseCase,
    RescheduleAppointmentUseCase,
    GetAppointmentUseCase,
    ChangeAppointmentStatusUseCase,
  ],
})
export class SchedulingModule {}
