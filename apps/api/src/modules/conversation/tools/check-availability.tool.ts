import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';

export const CheckAvailabilityInputSchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const CheckAvailabilityTool: Tool<typeof CheckAvailabilityInputSchema> = {
  name: 'check_availability',
  description:
    'Devuelve los slots disponibles (HH:MM) de un doctor en una fecha, considerando horario y cupo diario.',
  inputSchema: CheckAvailabilityInputSchema,
  requiredPermissions: ['read:availability'],
  async execute(input: any, ctx: any) {
    const useCase = ctx.deps.checkAvailability;
    if (!useCase) throw new Error('checkAvailability not injected');
    const result = await useCase.execute({ doctorId: input.doctorId, date: input.date });
    return {
      doctorId: result.doctorId,
      date: result.date,
      availableSlots: result.slots.filter((s: any) => s.available).map((s: any) => s.time),
      capacity: result.capacity,
    };
  },
};
