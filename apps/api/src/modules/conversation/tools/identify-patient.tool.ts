import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';
import { Id } from '../../../shared/utils/id.util';
import { PhoneNumber, Email, Cedula, Age } from '../../../domain/shared/value-objects';
import { Patient } from '../../../domain/identity/patient.entity';

export const IdentifyPatientInputSchema = z.object({
  phone: z.string().min(8).optional(),
  waPhone: z.string().min(8).optional(),
  email: z.string().email().optional(),
  cedula: z.number().int().positive().optional(),
  // Si es nuevo y hay que crearlo:
  createIfMissing: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((v) => v === true || v === 'true')
    .default(false),
  name: z.string().optional(),
  lastname: z.string().optional(),
  birthdate: z.string().optional(),
  address: z.string().optional(),
  gender: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type IdentifyPatientInput = z.infer<typeof IdentifyPatientInputSchema>;

export const IdentifyPatientTool: Tool<typeof IdentifyPatientInputSchema> = {
  name: 'identify_patient',
  description:
    'Busca un paciente existente por telÃ©fono, email o cÃ©dula. Si no existe y createIfMissing=true, lo registra.',
  inputSchema: IdentifyPatientInputSchema,
  requiredPermissions: ['read:patients'],
  async execute(input, ctx: ToolContext) {
    const repo = ctx.deps.patientRepo;
    if (!repo) throw new Error('patientRepo not injected');

    let patient: Patient | null = null;

    if (input.phone) {
      const phone = PhoneNumber.create(input.phone);
      patient = await repo.findByPhone(phone.value);
    }
    if (!patient && input.waPhone) {
      const wa = PhoneNumber.create(input.waPhone);
      patient = await repo.findByWaPhone(wa.value);
    }
    if (!patient && input.email) {
      const email = Email.create(input.email);
      patient = await repo.findByEmail(email.value);
    }
    if (!patient && input.cedula) {
      const ced = Cedula.create(input.cedula);
      patient = await repo.findByCedula(ced.value);
    }

    if (patient) {
      return {
        found: true,
        patientId: patient.id,
        // NO enviar PHI: solo firstName + cedula anonimizada
        firstName: patient.name.name,
        cedula: '***' + patient.cedula.value.toString().slice(-4),
      };
    }

    if (!input.createIfMissing) {
      return { found: false };
    }

    if (!input.name || !input.lastname || !input.phone) {
      throw new Error('name, lastname and phone are required to create a patient');
    }

    const phone = PhoneNumber.create(input.phone);
    const newPatient = Patient.create({
      id: Id.new(),
      name: input.name,
      lastname: input.lastname,
      age: input.birthdate
        ? Age.fromBirthdate(new Date(input.birthdate)).value
        : 0,
      cedula: input.cedula ?? Math.floor(Math.random() * 99999999),
      email: input.email ?? `${phone.value.replace(/\D/g, '')}@placeholder.local`,
      phone: phone.value,
      waPhone: input.waPhone ?? phone.value,
      birthdate: input.birthdate ? new Date(input.birthdate) : new Date('1970-01-01'),
      address: input.address ?? 'Sin direcciÃ³n',
      gender: input.gender ?? 1,
    });
    await repo.save(newPatient);

    return {
      found: true,
      patientId: newPatient.id,
      created: true,
      firstName: newPatient.name.name,
    };
  },
};
