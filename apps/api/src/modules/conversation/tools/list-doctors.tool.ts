import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';

export const ListDoctorsInputSchema = z.object({
  specialtyId: z.string().optional(),
  activeOnly: z.boolean().default(true),
});

export const ListDoctorsTool: Tool<typeof ListDoctorsInputSchema> = {
  name: 'list_doctors',
  description:
    'Lista los doctores activos del consultorio, opcionalmente filtrados por especialidad.',
  inputSchema: ListDoctorsInputSchema,
  requiredPermissions: ['read:doctors'],
  async execute(input: any, ctx: any) {
    const repo = ctx.deps.doctorRepo;
    if (!repo) throw new Error('doctorRepo not injected');

    const doctors = await repo.findMany({
      ...(input.specialtyId ? { specialtyId: input.specialtyId } : {}),
      ...(input.activeOnly !== undefined ? { active: input.activeOnly } : {}),
    });

    // Anonimizar para el LLM: solo firstName + specialtyId + dailyLimit.
    return doctors.map((d: any) => ({
      doctorId: d.id,
      firstName: d.name.name,
      lastName: d.name.lastname,
      specialtyId: d.specialtyId,
      dailyLimit: d.dailyLimit,
    }));
  },
};
