import { Inject, Injectable } from '@nestjs/common';
import { Patient } from '../../../domain/identity/patient.entity';
import {
  IPatientRepository,
  PatientFilter,
  PATIENT_REPOSITORY,
} from '../../../domain/identity/repositories';
import { NotFoundError } from '../../../shared/errors/domain.errors';

@Injectable()
export class GetPatientUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly repo: IPatientRepository) {}

  async byId(id: string): Promise<Patient> {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundError('Patient', id);
    return p;
  }

  async byPhone(phone: string): Promise<Patient | null> {
    return this.repo.findByPhone(phone);
  }

  async byWaPhone(waPhone: string): Promise<Patient | null> {
    return this.repo.findByWaPhone(waPhone);
  }

  async byCedula(cedula: number): Promise<Patient | null> {
    return this.repo.findByCedula(cedula);
  }

  async list(filter: PatientFilter, opts?: { limit?: number; offset?: number }): Promise<Patient[]> {
    return this.repo.findMany(filter, opts);
  }
}
