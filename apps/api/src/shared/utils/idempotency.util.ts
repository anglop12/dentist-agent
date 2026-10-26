import { v7 as uuidv7 } from 'uuid';
import { createHash } from 'crypto';

/**
 * Generador de idempotency keys.
 * Para citas: appointment:{clinic}:{doctorId}:{date}:{time}:{patientId}.
 * Para mensajes WA: wa:{channel}:{to}:{hash(text)}.
 */
export class IdempotencyKey {
  static forAppointment(args: {
    doctorId: string;
    date: string;
    time: string;
    patientId: string;
  }): string {
    return `appt:${args.doctorId}:${args.date}:${args.time}:${args.patientId}`;
  }

  static forWhatsAppMessage(channel: string, to: string, text: string): string {
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
    return `wa:${channel}:${to}:${hash}`;
  }

  static forJob(jobName: string, appointmentId: string): string {
    return `${jobName}:${appointmentId}`;
  }

  /** Genera una key única para casos no determinísticos. */
  static random(): string {
    return uuidv7();
  }
}
