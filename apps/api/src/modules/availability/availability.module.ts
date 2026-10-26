import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { CheckAvailabilityUseCase, ValidateSlotUseCase } from './use-cases/check-availability.usecase';
import { APPOINTMENT_REPOSITORY } from '../../domain/scheduling/repositories';
import { SqliteAppointmentRepository } from '../../infrastructure/database/repositories/sqlite-appointment.repository';
import { DOCTOR_REPOSITORY } from '../../domain/identity/repositories';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [IdentityModule],
  controllers: [AvailabilityController],
  providers: [
    CheckAvailabilityUseCase,
    ValidateSlotUseCase,
    { provide: APPOINTMENT_REPOSITORY, useClass: SqliteAppointmentRepository },
  ],
  exports: [CheckAvailabilityUseCase, ValidateSlotUseCase],
})
export class AvailabilityModule {}
