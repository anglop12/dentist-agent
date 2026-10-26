import { BusinessRuleError } from '../../shared/errors/domain.errors';
import { DateOnly, TimeOfDay } from '../shared/value-objects';
import { AppointmentStatusVO, AppointmentStatus } from './appointment-status';

export type AppointmentSource = 'web' | 'whatsapp' | 'agent' | 'phone' | 'in_person';

export const APPOINTMENT_SOURCES: AppointmentSource[] = [
  'web',
  'whatsapp',
  'agent',
  'phone',
  'in_person',
];

/**
 * Aggregate root de cita médica.
 * Encapsula invariantes: cupo, transición de estados, anti-duplicado.
 */
export class MedicalAppointment {
  private constructor(
    public readonly id: string,
    public readonly patientId: string,
    public readonly doctorId: string,
    public status: AppointmentStatusVO,
    public readonly date: DateOnly,
    public readonly time: TimeOfDay,
    public readonly source: AppointmentSource,
    public readonly conversationId: string | null,
    public paymentIntentId: string | null,
    public depositAmount: number | null,
    public readonly idempotencyKey: string | null,
    public notes: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  static create(props: {
    id: string;
    patientId: string;
    doctorId: string;
    date: string;
    time: string;
    source?: AppointmentSource;
    conversationId?: string | null;
    depositAmount?: number | null;
    idempotencyKey?: string | null;
    notes?: string | null;
  }): MedicalAppointment {
    const now = new Date();
    return new MedicalAppointment(
      props.id,
      props.patientId,
      props.doctorId,
      AppointmentStatusVO.pending(),
      DateOnly.create(props.date),
      TimeOfDay.create(props.time),
      props.source ?? 'agent',
      props.conversationId ?? null,
      null,
      props.depositAmount ?? null,
      props.idempotencyKey ?? null,
      props.notes ?? null,
      now,
      now,
    );
  }

  static reconstitute(props: {
    id: string;
    patientId: string;
    doctorId: string;
    statusCode: AppointmentStatus;
    date: string;
    time: string;
    source: AppointmentSource;
    conversationId: string | null;
    paymentIntentId: string | null;
    depositAmount: number | null;
    idempotencyKey?: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): MedicalAppointment {
    return new MedicalAppointment(
      props.id,
      props.patientId,
      props.doctorId,
      AppointmentStatusVO.create(props.statusCode),
      DateOnly.create(props.date),
      TimeOfDay.create(props.time),
      props.source,
      props.conversationId,
      props.paymentIntentId,
      props.depositAmount,
      props.idempotencyKey ?? null,
      props.notes,
      props.createdAt,
      props.updatedAt,
    );
  }

  /** Cambia el estado aplicando las reglas de la FSM. */
  changeStatus(next: AppointmentStatusVO): void {
    this.status = this.status.transitionTo(next);
    this.updatedAt = new Date();
  }

  reschedule(date: DateOnly, time: TimeOfDay): void {
    if (this.status.isTerminal()) {
      throw new BusinessRuleError(`Cannot reschedule a ${this.status.value} appointment`);
    }
    (this as any).date = date;
    (this as any).time = time;
    this.updatedAt = new Date();
  }

  attachPaymentIntent(intentId: string, depositCents: number): void {
    this.paymentIntentId = intentId;
    this.depositAmount = depositCents;
    this.updatedAt = new Date();
  }

  addNotes(notes: string): void {
    this.notes = notes;
    this.updatedAt = new Date();
  }

  isUpcoming(now: Date = new Date()): boolean {
    const dt = new Date(`${this.date.value}T${this.time.value}:00.000Z`);
    return dt.getTime() > now.getTime();
  }

  anonymized(): { date: string; time: string; doctorId: string } {
    return {
      date: this.date.value,
      time: this.time.value,
      doctorId: this.doctorId,
    };
  }
}
