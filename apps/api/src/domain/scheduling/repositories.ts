import { MedicalAppointment, AppointmentSource } from './appointment.entity';
import { AppointmentStatus } from './appointment-status';
import { DateOnly } from '../shared/value-objects';

export interface AppointmentFilter {
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  from?: DateOnly;
  to?: DateOnly;
}

export interface IAppointmentRepository {
  findById(id: string): Promise<MedicalAppointment | null>;
  findMany(filter: AppointmentFilter, opts?: { limit?: number; offset?: number }): Promise<MedicalAppointment[]>;
  /** Devuelve la cita activa (pending/confirmed/checked_in) para el doctor/fecha/hora. */
  findActiveSlot(doctorId: string, date: string, time: string): Promise<MedicalAppointment | null>;
  /** Cuenta citas activas del doctor en una fecha (para validar cupo). */
  countActiveByDoctorAndDate(doctorId: string, date: string): Promise<number>;
  save(appointment: MedicalAppointment): Promise<void>;
  delete(id: string): Promise<void>;
  findByConversationId(conversationId: string): Promise<MedicalAppointment | null>;
}

export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');

export type SourceType = AppointmentSource;
