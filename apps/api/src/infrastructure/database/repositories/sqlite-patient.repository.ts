import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { patients as patientsTable } from '../schema';
import { Patient } from '../../../domain/identity/patient.entity';
import { IPatientRepository, PatientFilter } from '../../../domain/identity/repositories';
import { DB_TOKEN } from '../database.tokens';
import { Inject } from '@nestjs/common';

@Injectable()
export class SqlitePatientRepository implements IPatientRepository {
  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}

  private get db() {
    return this.conn.db;
  }

  async findById(id: string): Promise<Patient | null> {
    const rows = await this.db.select().from(patientsTable).where(eq(patientsTable.id, id)).limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByPhone(phone: string): Promise<Patient | null> {
    const rows = await this.db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.phone, phone))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByWaPhone(waPhone: string): Promise<Patient | null> {
    const rows = await this.db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.waPhone, waPhone))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<Patient | null> {
    const rows = await this.db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.email, email.toLowerCase()))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByCedula(cedula: number): Promise<Patient | null> {
    const rows = await this.db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.cedula, cedula))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findMany(filter: PatientFilter, opts?: { limit?: number; offset?: number }): Promise<Patient[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    let q: any = this.db.select().from(patientsTable);
    const conds: any[] = [];
    if (filter.email) conds.push(eq(patientsTable.email, filter.email.toLowerCase()));
    if (filter.phone) conds.push(eq(patientsTable.phone, filter.phone));
    if (filter.waPhone) conds.push(eq(patientsTable.waPhone, filter.waPhone));
    if (filter.cedula) conds.push(eq(patientsTable.cedula, filter.cedula));
    if (conds.length === 1) q = q.where(conds[0]);
    if (conds.length > 1) q = q.where(conds.reduce((a, b) => (require('drizzle-orm').and(a, b))));
    const rows = await q.limit(limit).offset(offset);
    return rows.map((r: any) => this.toDomain(r));
  }

  async save(patient: Patient): Promise<void> {
    const row = this.toRow(patient);
    await this.db.insert(patientsTable).values(row).onConflictDoUpdate({
      target: patientsTable.id,
      set: {
        name: row.name,
        lastname: row.lastname,
        age: row.age,
        email: row.email,
        phone: row.phone,
        waPhone: row.waPhone,
        address: row.address,
        gender: row.gender,
        notes: row.notes,
        updatedAt: row.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(patientsTable).where(eq(patientsTable.id, id));
  }

  async count(filter?: PatientFilter): Promise<number> {
    const all = await this.findMany(filter ?? {}, { limit: 1_000_000, offset: 0 });
    return all.length;
  }

  private toDomain(r: any): Patient {
    return Patient.reconstitute({
      id: r.id,
      name: r.name,
      lastname: r.lastname,
      age: r.age,
      cedula: r.cedula,
      email: r.email,
      phone: r.phone,
      waPhone: r.waPhone,
      birthdate: r.birthdate,
      address: r.address,
      gender: r.gender,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  private toRow(p: Patient): any {
    return {
      id: p.id,
      name: p.name.name,
      lastname: p.name.lastname,
      age: p.age.value,
      cedula: p.cedula.value,
      email: p.email.value,
      phone: p.phone.value,
      waPhone: p.waPhone.value,
      birthdate: p.birthdate,
      address: p.address,
      gender: p.gender,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
