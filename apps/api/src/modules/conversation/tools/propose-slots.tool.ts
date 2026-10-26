import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';

export const ProposeSlotsInputSchema = z.object({
  slots: z
    .array(
      z.object({
        doctorId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    )
    .min(1)
    .max(5),
});

/**
 * Marca unos slots como tentativos para el paciente.
 * ImplementaciÃ³n: persiste en el contexto de la conversaciÃ³n (TTL 10 min).
 * No bloquea el cupo real (eso lo hace create_appointment al confirmar).
 */
export const ProposeSlotsTool: Tool<typeof ProposeSlotsInputSchema> = {
  name: 'propose_slots',
  description:
    'Presenta al paciente una lista corta de horarios tentativos. Quedan guardados en el contexto de conversaciÃ³n.',
  inputSchema: ProposeSlotsInputSchema,
  requiredPermissions: ['write:availability'],
  async execute(input: any, ctx: any) {
    return {
      proposed: input.slots,
      ttlMinutes: 10,
      message:
        'Slots tentativos propuestos. Esperando confirmaciÃ³n del paciente.',
    };
  },
};
