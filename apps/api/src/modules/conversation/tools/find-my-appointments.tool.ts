import { z } from 'zod';
import { Tool, ToolContext } from '../../../domain/intelligence/tool';

export const FindMyAppointmentsInputSchema = z.object({
  patientId: z.string().min(1),
});

export interface FindMyAppointmentsResult {
  appointments: Array<{
    appointmentId: string;
    date: string;
    time: string;
    status: string;
    doctorId: string;
  }>;
}

/**
 * Devuelve las citas ACTIVAS (no terminales) de un paciente.
 * Es EL prerrequisito para cancelar o reagendar: sin esto el modelo
 * no tiene cómo obtener el appointmentId.
 */
export const FindMyAppointmentsTool: Tool<typeof FindMyAppointmentsInputSchema> = {
  name: 'find_my_appointments',
  description:
    'Lista las citas activas (pendientes/confirmadas/en sala) de un paciente con su appointmentId. Úsala SIEMPRE antes de cancelar o reagendar.',
  inputSchema: FindMyAppointmentsInputSchema,
  requiredPermissions: ['read:appointments'],
  async execute(input, ctx) {
    const useCase = ctx.deps.getAppointment;
    if (!useCase) throw new Error('getAppointment not injected');
    const rows = await useCase.upcomingByPatient(input.patientId);
    return {
      appointments: rows.map((a: any) => ({
        appointmentId: a.id,
        date: a.date.value,
        time: a.time.value,
        status: a.status.value,
        doctorId: a.doctorId,
      })),
    };
  },
};
