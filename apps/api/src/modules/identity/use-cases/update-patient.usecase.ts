import { Inject, Injectable } from '@nestjs/common';
import {
  IPatientRepository,
  PATIENT_REPOSITORY,
} from '../../../domain/identity/repositories';
import { NotFoundError } from '../../../shared/errors/domain.errors';

@Injectable()
export class UpdatePatientUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly repo: IPatientRepository) {}

  async updateNotes(id: string, notes: string | null): Promise<void> {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundError('Patient', id);
    p.updateNotes(notes);
    await this.repo.save(p);
  }

  async updateContact(id: string, email: string, phone: string): Promise<void> {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundError('Patient', id);
    p.updateContact(email, phone);
    await this.repo.save(p);
  }
}
