import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Patient } from '../../../domain/identity/patient.entity';
import {
  IPatientRepository,
  PATIENT_REPOSITORY,
} from '../../../domain/identity/repositories';
import { Id } from '../../../shared/utils/id.util';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/domain.errors';

export const CreatePatientSchema = z.object({
  name: z.string().min(1).max(100),
  lastname: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
  cedula: z.number().int().positive(),
  email: z.string().email(),
  phone: z.string().min(8),
  waPhone: z.string().min(8).optional(),
  birthdate: z.union([z.string(), z.date()]).transform((v) => (typeof v === 'string' ? new Date(v) : v)),
  address: z.string().min(1),
  gender: z.union([z.literal(0), z.literal(1)]),
  notes: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

@Injectable()
export class CreatePatientUseCase {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: IPatientRepository,
  ) {}

  async execute(input: CreatePatientInput): Promise<Patient> {
    const parsed = CreatePatientSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError('Invalid patient data', this.formatIssues(parsed.error));
    }
    const data = parsed.data;

    // Anti-duplicado por cedula / email / waPhone
    const [byCedula, byEmail, byWa] = await Promise.all([
      this.repo.findByCedula(data.cedula),
      this.repo.findByEmail(data.email),
      data.waPhone ? this.repo.findByWaPhone(data.waPhone) : Promise.resolve(null),
    ]);

    if (byCedula) throw new ConflictError(`Patient with cedula ${data.cedula} already exists`);
    if (byEmail) throw new ConflictError(`Patient with email ${data.email} already exists`);
    if (byWa) throw new ConflictError(`Patient with WhatsApp ${data.waPhone} already exists`);

    try {
      const patient = Patient.create({ id: Id.new(), ...data });
      await this.repo.save(patient);
      return patient;
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      throw new ValidationError((e as Error).message);
    }
  }

  private formatIssues(err: z.ZodError) {
    return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  }
}
