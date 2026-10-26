import { Injectable } from '@nestjs/common';
import { Doctor, Specialty } from '../../../src/domain/identity/doctor.entity';
import {
  IDoctorRepository,
  ISpecialtyRepository,
} from '../../../src/domain/identity/repositories';

@Injectable()
export class InMemoryDoctorRepository implements IDoctorRepository {
  private store = new Map<string, Doctor>();

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findMany(filter?: { specialtyId?: string; active?: boolean }) {
    let arr = [...this.store.values()];
    if (filter?.specialtyId) arr = arr.filter((d) => d.specialtyId === filter.specialtyId);
    if (filter?.active !== undefined) arr = arr.filter((d) => d.active === filter.active);
    return arr;
  }
  async save(d: Doctor) {
    this.store.set(d.id, d);
  }
  async delete(id: string) {
    this.store.delete(id);
  }
}

@Injectable()
export class InMemorySpecialtyRepository implements ISpecialtyRepository {
  private store = new Map<string, Specialty>();

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
  async findMany(filter?: { active?: boolean }) {
    let arr = [...this.store.values()];
    if (filter?.active !== undefined) arr = arr.filter((s) => s.active === filter.active);
    return arr;
  }
  async save(s: Specialty) {
    this.store.set(s.id, s);
  }
  async delete(id: string) {
    this.store.delete(id);
  }
}
