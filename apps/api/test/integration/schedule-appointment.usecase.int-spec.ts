import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ScheduleAppointmentUseCase } from '../../src/modules/scheduling/use-cases/schedule-appointment.usecase';
import { CancelAppointmentUseCase } from '../../src/modules/scheduling/use-cases/manage-appointment.usecases';
import {
  IAppointmentRepository,
  APPOINTMENT_REPOSITORY,
} from '../../src/domain/scheduling/repositories';
import {
  IPatientRepository,
  PATIENT_REPOSITORY,
} from '../../src/domain/identity/repositories';
import {
  IDoctorRepository,
  DOCTOR_REPOSITORY,
} from '../../src/domain/identity/repositories';
import { IClock, SystemClock, CLOCK } from '../../src/shared/utils/clock.util';
import {
  ConflictError,
  BusinessRuleError,
  NotFoundError,
} from '../../src/shared/errors/domain.errors';
import { MedicalAppointment } from '../../src/domain/scheduling/appointment.entity';
import { Patient } from '../../src/domain/identity/patient.entity';
import { Doctor } from '../../src/domain/identity/doctor.entity';
import { InMemoryAppointmentRepository } from './in-memory-appointment-repo';
import { InMemoryPatientRepository } from './in-memory-patient-repo';
import { InMemoryDoctorRepository } from './in-memory-doctor-repo';

describe('ScheduleAppointmentUseCase (integration)', () => {
  let app: INestApplication;
  let schedule: ScheduleAppointmentUseCase;
  let cancel: CancelAppointmentUseCase;
  let patientRepo: IPatientRepository;
  let doctorRepo: IDoctorRepository;
  let patientId: string;
  let doctorId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = ':memory:';
    process.env.LLM_PROVIDER = 'ollama';
    const m = await Test.createTestingModule({
      providers: [
        ScheduleAppointmentUseCase,
        CancelAppointmentUseCase,
        { provide: APPOINTMENT_REPOSITORY, useClass: InMemoryAppointmentRepository },
        { provide: PATIENT_REPOSITORY, useClass: InMemoryPatientRepository },
        { provide: DOCTOR_REPOSITORY, useClass: InMemoryDoctorRepository },
        { provide: CLOCK, useClass: SystemClock },
      ],
    }).compile();
    app = m.createNestApplication();
    await app.init();

    schedule = app.get(ScheduleAppointmentUseCase);
    cancel = app.get(CancelAppointmentUseCase);
    patientRepo = app.get(PATIENT_REPOSITORY);
    doctorRepo = app.get(DOCTOR_REPOSITORY);

    // Seed
    const p = Patient.create({
      id: 'p-1', name: 'P', lastname: 'X', age: 30, cedula: 12345,
      email: 'p@x.com', phone: '+584141234567', birthdate: new Date('1996-01-01'),
      address: 'a', gender: 1,
    });
    await patientRepo.save(p);
    patientId = p.id;

    const d = Doctor.create({
      id: 'd-1', name: 'D', lastname: 'Y', cedula: 99999, email: 'd@y.com',
      phone: '+584141234568', specialtyId: 'spec-1', dailyLimit: 2,
    });
    await doctorRepo.save(d);
    doctorId = d.id;
  });

  afterAll(async () => await app.close());

  it('creates an appointment in pending state', async () => {
    const a = await schedule.execute({
      patientId, doctorId, date: '2026-08-21', time: '10:00', source: 'web',
    });
    expect(a).toBeInstanceOf(MedicalAppointment);
    expect(a.status.value).toBe('pending');
  });

  it('rejects duplicate slot with ConflictError', async () => {
    await expect(
      schedule.execute({ patientId, doctorId, date: '2026-08-21', time: '10:00', source: 'web' }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects when daily limit exceeded', async () => {
    await schedule.execute({ patientId, doctorId, date: '2026-08-21', time: '11:00', source: 'web' });
    await expect(
      schedule.execute({ patientId, doctorId, date: '2026-08-21', time: '12:00', source: 'web' }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it('throws NotFoundError for unknown patient', async () => {
    await expect(
      schedule.execute({ patientId: 'xxx', doctorId, date: '2026-08-22', time: '10:00', source: 'web' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('cancels a pending appointment', async () => {
    const a = await schedule.execute({ patientId, doctorId, date: '2026-08-23', time: '10:00', source: 'web' });
    const cancelled = await cancel.execute({ appointmentId: a.id, reason: 'test' });
    expect(cancelled.status.value).toBe('cancelled');
  });
});
