import { Module } from '@nestjs/common';
import { PatientController } from './patient.controller';
import { DoctorController } from './doctor.controller';
import { CreatePatientUseCase } from './use-cases/create-patient.usecase';
import { GetPatientUseCase } from './use-cases/get-patient.usecase';
import { UpdatePatientUseCase } from './use-cases/update-patient.usecase';
import { DeletePatientUseCase } from './use-cases/delete-patient.usecase';
import { CreateDoctorUseCase, GetDoctorUseCase } from './use-cases/doctor.usecases';
import {
  PATIENT_REPOSITORY,
  DOCTOR_REPOSITORY,
  SPECIALTY_REPOSITORY,
} from '../../domain/identity/repositories';
import {
  SqlitePatientRepository,
} from '../../infrastructure/database/repositories/sqlite-patient.repository';
import {
  SqliteDoctorRepository,
  SqliteSpecialtyRepository,
} from '../../infrastructure/database/repositories/sqlite-doctor.repository';

@Module({
  controllers: [PatientController, DoctorController],
  providers: [
    CreatePatientUseCase,
    GetPatientUseCase,
    UpdatePatientUseCase,
    DeletePatientUseCase,
    CreateDoctorUseCase,
    GetDoctorUseCase,
    { provide: PATIENT_REPOSITORY, useClass: SqlitePatientRepository },
    { provide: DOCTOR_REPOSITORY, useClass: SqliteDoctorRepository },
    { provide: SPECIALTY_REPOSITORY, useClass: SqliteSpecialtyRepository },
  ],
  exports: [PATIENT_REPOSITORY, DOCTOR_REPOSITORY, SPECIALTY_REPOSITORY],
})
export class IdentityModule {}
