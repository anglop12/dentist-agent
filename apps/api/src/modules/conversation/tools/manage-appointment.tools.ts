import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';

export const CancelAppointmentInputSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().optional(),
});

export const CancelAppointmentTool: Tool<typeof CancelAppointmentInputSchema> = {
  name: 'cancel_appointment',
  description: 'Cancela una cita existente.',
  inputSchema: CancelAppointmentInputSchema,
  requiredPermissions: ['write:appointments'],
  async execute(input: any, ctx: any) {
    const useCase = ctx.deps.cancelAppointment;
    if (!useCase) throw new Error('cancelAppointment not injected');
    const appt = await useCase.execute({ appointmentId: input.appointmentId, reason: input.reason });
    return {
      appointmentId: appt.id,
      status: appt.status.value,
    };
  },
};

export const RescheduleAppointmentInputSchema = z
  .object({
    appointmentId: z.string().min(1),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .superRefine((args, ctx) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (new Date(`${args.newDate}T00:00:00`) < hoy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newDate'],
        message: `La fecha ${args.newDate} ya pasó. Hoy es ${hoy.toISOString().slice(0, 10)}. Usa una fecha futura.`,
      });
    }
  });

export const RescheduleAppointmentTool: Tool<typeof RescheduleAppointmentInputSchema> = {
  name: 'reschedule_appointment',
  description: 'Cambia la fecha y/u hora de una cita existente.',
  inputSchema: RescheduleAppointmentInputSchema,
  requiredPermissions: ['write:appointments'],
  async execute(input: any, ctx: any) {
    const useCase = ctx.deps.rescheduleAppointment;
    if (!useCase) throw new Error('rescheduleAppointment not injected');
    const appt = await useCase.execute({
      appointmentId: input.appointmentId,
      newDate: input.newDate,
      newTime: input.newTime,
    });
    return {
      appointmentId: appt.id,
      date: appt.date.value,
      time: appt.time.value,
      status: appt.status.value,
    };
  },
};
