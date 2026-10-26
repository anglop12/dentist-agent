import { Injectable } from '@nestjs/common';
import { Patient } from '../../../src/domain/identity/patient.entity';
import {
  IPatientRepository,
  PatientFilter,
} from '../../../src/domain/identity/repositories';

@Injectable()
export class InMemoryPatientRepository implements IPatientRepository {
  private store = new Map<string, Patient>();

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findByPhone(phone: string) {
    for (const p of this.store.values()) if (p.phone.value === phone) return p;
    return null;
  }
  async findByWaPhone(wa: string) {
    for (const p of this.store.values()) if (p.waPhone.value === wa) return p;
    return null;
  }
  async findByEmail(email: string) {
    for (const p of this.store.values()) if (p.email.value === email) return p;
    return null;
  }
  async findByCedula(cedula: number) {
    for (const p of this.store.values()) if (p.cedula.value === cedula) return p;
    return null;
  }
  async findMany(_filter: PatientFilter, _opts?: { limit?: number; offset?: number }) {
    return [...this.store.values()];
  }
  async save(p: Patient) {
    this.store.set(p.id, p);
  }
  async delete(id: string) {
    this.store.delete(id);
  }
  async count() {
    return this.store.size;
  }
}
