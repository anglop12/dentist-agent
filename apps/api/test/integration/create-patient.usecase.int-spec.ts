import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CreatePatientUseCase } from '../../src/modules/identity/use-cases/create-patient.usecase';
import { GetPatientUseCase } from '../../src/modules/identity/use-cases/get-patient.usecase';
import { Patient } from '../../src/domain/identity/patient.entity';
import { NotFoundError, ConflictError, ValidationError } from '../../src/shared/errors/domain.errors';
import { IPatientRepository, PATIENT_REPOSITORY } from '../../src/domain/identity/repositories';
import { InMemoryPatientRepository } from './in-memory-patient-repo';

describe('CreatePatientUseCase (integration)', () => {
  let app: INestApplication;
  let createUC: CreatePatientUseCase;
  let getUC: GetPatientUseCase;

  beforeAll(async () => {
    process.env.DATABASE_URL = ':memory:';
    process.env.LLM_PROVIDER = 'ollama';
    const m = await Test.createTestingModule({
      providers: [
        CreatePatientUseCase,
        GetPatientUseCase,
        { provide: PATIENT_REPOSITORY, useClass: InMemoryPatientRepository },
      ],
    }).compile();
    app = m.createNestApplication();
    await app.init();
    createUC = app.get(CreatePatientUseCase);
    getUC = app.get(GetPatientUseCase);
  });

  afterAll(async () => {
    await app.close();
  });

  const baseInput = {
    name: 'Test',
    lastname: 'Patient',
    age: 30,
    cedula: 12345678,
    email: 'test@example.com',
    phone: '+584141234567',
    birthdate: new Date('1996-01-01'),
    address: 'Calle 1',
    gender: 1 as const,
  };

  it('creates a patient', async () => {
    const p = await createUC.execute(baseInput);
    expect(p).toBeInstanceOf(Patient);
    expect(p.name.full).toBe('Test Patient');
  });

  it('rejects duplicate cedula with ConflictError', async () => {
    await expect(createUC.execute({ ...baseInput, email: 'other@example.com' })).rejects.toThrow(ConflictError);
  });

  it('rejects duplicate email with ConflictError', async () => {
    await expect(createUC.execute({ ...baseInput, cedula: 99999999 })).rejects.toThrow(ConflictError);
  });

  it('rejects invalid email with ValidationError', async () => {
    await expect(createUC.execute({ ...baseInput, cedula: 111, email: 'invalid' })).rejects.toThrow();
  });

  it('getPatient.byId returns the created patient', async () => {
    const created = await createUC.execute({
      ...baseInput,
      cedula: 22222222,
      email: 'get-test@example.com',
    });
    const got = await getUC.byId(created.id);
    expect(got.id).toBe(created.id);
  });

  it('getPatient.byId throws NotFoundError for unknown id', async () => {
    await expect(getUC.byId('non-existent')).rejects.toThrow(NotFoundError);
  });
});
