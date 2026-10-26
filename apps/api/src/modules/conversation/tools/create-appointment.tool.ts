import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';

export const CreateAppointmentInputSchema = z
  .object({
    patientId: z.string().min(1),
    doctorId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    notes: z.string().optional(),
  })
  .superRefine((args, ctx) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (new Date(`${args.date}T00:00:00`) < hoy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date'],
        message: `La fecha ${args.date} ya pasó. Hoy es ${hoy.toISOString().slice(0, 10)}. Usa una fecha futura (año ${hoy.getFullYear()} o posterior).`,
      });
    }
  });

export const CreateAppointmentTool: Tool<typeof CreateAppointmentInputSchema> = {
  name: 'create_appointment',
  description:
    'Crea una cita mÃ©dica para un paciente con un doctor en fecha/hora especÃ­fica. Valida cupo y duplicados.',
  inputSchema: CreateAppointmentInputSchema,
  requiredPermissions: ['write:appointments'],
  async execute(input: any, ctx: any) {
    const useCase = ctx.deps.scheduleAppointment;
    if (!useCase) throw new Error('scheduleAppointment not injected');

    const appt = await useCase.execute({
      patientId: input.patientId,
      doctorId: input.doctorId,
      date: input.date,
      time: input.time,
      source: 'agent',
      conversationId: ctx.conversationId,
      notes: input.notes,
    });

    return {
      appointmentId: appt.id,
      status: appt.status.value,
      date: appt.date.value,
      time: appt.time.value,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
    };
  },
};
