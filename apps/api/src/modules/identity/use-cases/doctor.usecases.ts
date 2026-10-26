import { Inject, Injectable } from '@nestjs/common';
import { Doctor } from '../../../domain/identity/doctor.entity';
import {
  IDoctorRepository,
  DOCTOR_REPOSITORY,
} from '../../../domain/identity/repositories';
import { Id } from '../../../shared/utils/id.util';
import { ConflictError, NotFoundError } from '../../../shared/errors/domain.errors';

export interface CreateDoctorInput {
  name: string;
  lastname: string;
  cedula: number;
  email: string;
  phone: string;
  specialtyId: string;
  dailyLimit?: number | null;
}

@Injectable()
export class CreateDoctorUseCase {
  constructor(@Inject(DOCTOR_REPOSITORY) private readonly repo: IDoctorRepository) {}

  async execute(input: CreateDoctorInput): Promise<Doctor> {
    try {
      const d = Doctor.create({ id: Id.new(), ...input });
      await this.repo.save(d);
      return d;
    } catch (e) {
      throw new ConflictError((e as Error).message);
    }
  }
}

@Injectable()
export class GetDoctorUseCase {
  constructor(@Inject(DOCTOR_REPOSITORY) private readonly repo: IDoctorRepository) {}

  async byId(id: string): Promise<Doctor> {
    const d = await this.repo.findById(id);
    if (!d) throw new NotFoundError('Doctor', id);
    return d;
  }

  async list(filter?: { specialtyId?: string; active?: boolean }): Promise<Doctor[]> {
    return this.repo.findMany(filter);
  }
}
