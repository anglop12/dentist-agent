import { Injectable, Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { doctors as doctorsTable, specialties as specialtiesTable } from '../schema';
import { Doctor, Specialty } from '../../../domain/identity/doctor.entity';
import {
  IDoctorRepository,
  ISpecialtyRepository,
} from '../../../domain/identity/repositories';
import { DB_TOKEN } from '../database.tokens';

@Injectable()
export class SqliteDoctorRepository implements IDoctorRepository {
  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async findById(id: string): Promise<Doctor | null> {
    const rows = await this.db.select().from(doctorsTable).where(eq(doctorsTable.id, id)).limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findMany(filter?: { specialtyId?: string; active?: boolean }): Promise<Doctor[]> {
    const conds: any[] = [];
    if (filter?.specialtyId) conds.push(eq(doctorsTable.specialtyId, filter.specialtyId));
    if (filter?.active !== undefined) conds.push(eq(doctorsTable.active, filter.active));
    let q: any = this.db.select().from(doctorsTable);
    if (conds.length === 1) q = q.where(conds[0]);
    if (conds.length > 1) q = q.where(and(...conds));
    const rows = await q;
    return rows.map((r: any) => this.toDomain(r));
  }

  async save(doctor: Doctor): Promise<void> {
    const row = this.toRow(doctor);
    await this.db.insert(doctorsTable).values(row).onConflictDoUpdate({
      target: doctorsTable.id,
      set: {
        name: row.name,
        lastname: row.lastname,
        email: row.email,
        phone: row.phone,
        specialtyId: row.specialtyId,
        dailyLimit: row.dailyLimit,
        active: row.active,
        updatedAt: row.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(doctorsTable).where(eq(doctorsTable.id, id));
  }

  private toDomain(r: any): Doctor {
    return Doctor.reconstitute({
      id: r.id,
      name: r.name,
      lastname: r.lastname,
      cedula: r.cedula,
      email: r.email,
      phone: r.phone,
      specialtyId: r.specialtyId,
      dailyLimit: r.dailyLimit,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  private toRow(d: Doctor): any {
    return {
      id: d.id,
      name: d.name.name,
      lastname: d.name.lastname,
      cedula: d.cedula.value,
      email: d.email.value,
      phone: d.phone.value,
      specialtyId: d.specialtyId,
      dailyLimit: d.dailyLimit,
      active: d.active,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}

@Injectable()
export class SqliteSpecialtyRepository implements ISpecialtyRepository {
  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async findById(id: string): Promise<Specialty | null> {
    const rows = await this.db.select().from(specialtiesTable).where(eq(specialtiesTable.id, id)).limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findMany(filter?: { active?: boolean }): Promise<Specialty[]> {
    const conds: any[] = [];
    if (filter?.active !== undefined) conds.push(eq(specialtiesTable.active, filter.active));
    let q: any = this.db.select().from(specialtiesTable);
    if (conds.length === 1) q = q.where(conds[0]);
    const rows = await q;
    return rows.map((r: any) => this.toDomain(r));
  }

  async save(specialty: Specialty): Promise<void> {
    const row = this.toRow(specialty);
    await this.db.insert(specialtiesTable).values(row).onConflictDoUpdate({
      target: specialtiesTable.id,
      set: {
        name: row.name,
        description: row.description,
        active: row.active,
        updatedAt: row.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(specialtiesTable).where(eq(specialtiesTable.id, id));
  }

  private toDomain(r: any): Specialty {
    return Specialty.reconstitute({
      id: r.id,
      name: r.name,
      description: r.description,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  private toRow(s: Specialty): any {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      active: s.active,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
