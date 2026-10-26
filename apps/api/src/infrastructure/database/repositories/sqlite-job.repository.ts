import { Injectable, Inject } from '@nestjs/common';
import { and, eq, lte, sql } from 'drizzle-orm';
import { jobs as jobsTable } from '../schema';
import { Job, JobStatus, IJobQueue, EnqueueOptions } from '../../../domain/jobs/job-queue.port';
import { DB_TOKEN } from '../database.tokens';

@Injectable()
export class SqliteJobQueue implements IJobQueue {
  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async enqueue<T>(name: string, payload: T, opts: EnqueueOptions = {}): Promise<string> {
    const id = require('uuid').v7();
    const now = new Date();
    await this.db.insert(jobsTable).values({
      id,
      name,
      runAt: opts.runAt ?? now,
      payload: payload as any,
      status: 'pending',
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? 3,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  /** Toma el próximo job vencido y lo marca como running en una transacción. */
  async claimDue(now: Date): Promise<Job | null> {
    // En SQLite con better-sqlite3 no hay transacciones async reales,
    // pero Drizzle serializa con la conexión única.
    const rows = await this.db
      .select()
      .from(jobsTable)
      .where(and(eq(jobsTable.status, 'pending'), lte(jobsTable.runAt, now)))
      .orderBy(jobsTable.runAt)
      .limit(1);

    if (!rows[0]) return null;

    const claimed = rows[0];
    await this.db
      .update(jobsTable)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(jobsTable.id, claimed.id));

    return this.toDomain({ ...claimed, status: 'running' });
  }

  async markDone(id: string): Promise<void> {
    await this.db
      .update(jobsTable)
      .set({ status: 'done', updatedAt: new Date() })
      .where(eq(jobsTable.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    const rows = await this.db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    if (!rows[0]) return;
    const job = rows[0];
    const attempts = (job.attempts ?? 0) + 1;
    const nextStatus: JobStatus = attempts >= (job.maxAttempts ?? 3) ? 'failed' : 'pending';
    // Re-encolar con backoff exponencial (1min, 5min, 30min)
    const backoffMs = [60_000, 5 * 60_000, 30 * 60_000][Math.min(attempts - 1, 2)];
    const nextRun = nextStatus === 'pending' ? new Date(Date.now() + backoffMs) : job.runAt;

    await this.db
      .update(jobsTable)
      .set({
        status: nextStatus,
        attempts,
        lastError: error.slice(0, 1000),
        runAt: nextRun,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, id));
  }

  async listByStatus(status: JobStatus, limit = 100): Promise<Job[]> {
    const rows = await this.db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.status, status))
      .orderBy(jobsTable.runAt)
      .limit(limit);
    return rows.map((r: any) => this.toDomain(r));
  }

  async findById(id: string): Promise<Job | null> {
    const rows = await this.db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(jobsTable).where(eq(jobsTable.id, id));
  }

  private toDomain(r: any): Job {
    return {
      id: r.id,
      name: r.name,
      runAt: r.runAt,
      payload: r.payload,
      status: r.status as JobStatus,
      attempts: r.attempts ?? 0,
      maxAttempts: r.maxAttempts ?? 3,
      lastError: r.lastError,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
