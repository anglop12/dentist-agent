import { Injectable, Inject } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { medicalAppointments as apptTable } from '../schema';
import { MedicalAppointment } from '../../../domain/scheduling/appointment.entity';
import { AppointmentStatus } from '../../../domain/scheduling/appointment-status';
import {
  AppointmentFilter,
  IAppointmentRepository,
} from '../../../domain/scheduling/repositories';
import { DB_TOKEN } from '../database.tokens';

const ACTIVE_STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'checked_in'];

@Injectable()
export class SqliteAppointmentRepository implements IAppointmentRepository {
  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async findById(id: string): Promise<MedicalAppointment | null> {
    const rows = await this.db.select().from(apptTable).where(eq(apptTable.id, id)).limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findMany(
    filter: AppointmentFilter,
    opts?: { limit?: number; offset?: number },
  ): Promise<MedicalAppointment[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const conds: any[] = [];
    if (filter.patientId) conds.push(eq(apptTable.patientId, filter.patientId));
    if (filter.doctorId) conds.push(eq(apptTable.doctorId, filter.doctorId));
    if (filter.status) conds.push(eq(apptTable.statusCode, filter.status));
    if (filter.from) conds.push(gte(apptTable.date, filter.from.value));
    if (filter.to) conds.push(lte(apptTable.date, filter.to.value));

    let q: any = this.db.select().from(apptTable);
    if (conds.length === 1) q = q.where(conds[0]);
    if (conds.length > 1) q = q.where(and(...conds));
    const rows = await q.limit(limit).offset(offset);
    return rows.map((r: any) => this.toDomain(r));
  }

  async findActiveSlot(
    doctorId: string,
    date: string,
    time: string,
  ): Promise<MedicalAppointment | null> {
    const rows = await this.db
      .select()
      .from(apptTable)
      .where(
        and(
          eq(apptTable.doctorId, doctorId),
          eq(apptTable.date, date),
          eq(apptTable.time, time),
        ),
      )
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async countActiveByDoctorAndDate(doctorId: string, date: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(apptTable)
      .where(
        and(
          eq(apptTable.doctorId, doctorId),
          eq(apptTable.date, date),
          sql`${apptTable.statusCode} IN (${sql.raw(
            ACTIVE_STATUSES.map((s) => `'${s}'`).join(','),
          )})`,
        ),
      );
    return rows[0]?.count ?? 0;
  }

  async save(appointment: MedicalAppointment): Promise<void> {
    const row = this.toRow(appointment);
        await this.db.insert(apptTable).values(row).onConflictDoUpdate({
      target: apptTable.id,
      set: {
        statusCode: row.statusCode,
        // date/time SÍ cambian vía reschedule — deben persistir
        date: row.date,
        time: row.time,
        paymentIntentId: row.paymentIntentId,
        depositAmount: row.depositAmount,
        idempotencyKey: row.idempotencyKey ?? null,
        notes: row.notes,
        updatedAt: row.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(apptTable).where(eq(apptTable.id, id));
  }

  async findByConversationId(conversationId: string): Promise<MedicalAppointment | null> {
    const rows = await this.db
      .select()
      .from(apptTable)
      .where(eq(apptTable.conversationId, conversationId))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  private toDomain(r: any): MedicalAppointment {
    return MedicalAppointment.reconstitute({
      id: r.id,
      patientId: r.patientId,
      doctorId: r.doctorId,
      statusCode: r.statusCode,
      date: r.date,
      time: r.time,
      source: r.source,
      conversationId: r.conversationId,
      paymentIntentId: r.paymentIntentId,
      depositAmount: r.depositAmount,
      idempotencyKey: r.idempotencyKey ?? null,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }

  private toRow(a: MedicalAppointment): any {
    return {
      id: a.id,
      patientId: a.patientId,
      doctorId: a.doctorId,
      statusCode: a.status.value,
      date: a.date.value,
      time: a.time.value,
      source: a.source,
      conversationId: a.conversationId,
      paymentIntentId: a.paymentIntentId,
      depositAmount: a.depositAmount,
      idempotencyKey: a.idempotencyKey ?? null,
      notes: a.notes,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
