import { Inject, Injectable } from '@nestjs/common';
import { IPatientRepository, PATIENT_REPOSITORY } from '../../../domain/identity/repositories';
import { NotFoundError } from '../../../shared/errors/domain.errors';

@Injectable()
export class DeletePatientUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly repo: IPatientRepository) {}

  async execute(id: string): Promise<void> {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundError('Patient', id);
    await this.repo.delete(id);
  }
}
