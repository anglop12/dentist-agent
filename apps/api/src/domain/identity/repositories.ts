import { Doctor, Specialty } from './doctor.entity';
import { Patient } from './patient.entity';

/**
 * Puerto de persistencia de pacientes.
 * Implementaciones en infrastructure/database/repositories.
 */

export interface PatientFilter {
  search?: string;
  email?: string;
  phone?: string;
  waPhone?: string;
  cedula?: number;
}

export interface IPatientRepository {
  findById(id: string): Promise<Patient | null>;
  findByPhone(phone: string): Promise<Patient | null>;
  findByWaPhone(waPhone: string): Promise<Patient | null>;
  findByEmail(email: string): Promise<Patient | null>;
  findByCedula(cedula: number): Promise<Patient | null>;
  findMany(filter: PatientFilter, opts?: { limit?: number; offset?: number }): Promise<Patient[]>;
  save(patient: Patient): Promise<void>;
  delete(id: string): Promise<void>;
  count(filter?: PatientFilter): Promise<number>;
}

export interface IDoctorRepository {
  findById(id: string): Promise<Doctor | null>;
  findMany(filter?: { specialtyId?: string; active?: boolean }): Promise<Doctor[]>;
  save(doctor: Doctor): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ISpecialtyRepository {
  findById(id: string): Promise<Specialty | null>;
  findMany(filter?: { active?: boolean }): Promise<Specialty[]>;
  save(specialty: Specialty): Promise<void>;
  delete(id: string): Promise<void>;
}

export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');
export const DOCTOR_REPOSITORY = Symbol('DOCTOR_REPOSITORY');
export const SPECIALTY_REPOSITORY = Symbol('SPECIALTY_REPOSITORY');
