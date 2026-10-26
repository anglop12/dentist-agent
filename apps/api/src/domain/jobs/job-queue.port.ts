/**
 * Puerto de cola de jobs (intercambiable: SQLite / BullMQ / Redis).
 */

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job<T = unknown> {
  id: string;
  name: string;
  runAt: Date;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueOptions {
  /** Cuando ejecutar el job. Por defecto: ahora. */
  runAt?: Date;
  /** Reintentos máximos en caso de fallo. Por defecto: 3. */
  maxAttempts?: number;
  /** Clave de idempotencia: evita encolar el mismo job dos veces. */
  idempotencyKey?: string;
}

export interface IJobQueue {
  enqueue<T>(name: string, payload: T, opts?: EnqueueOptions): Promise<string>;
  /** Toma el próximo job vencido y lo marca como running. */
  claimDue(now: Date): Promise<Job | null>;
  markDone(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  listByStatus(status: JobStatus, limit?: number): Promise<Job[]>;
  findById(id: string): Promise<Job | null>;
  delete(id: string): Promise<void>;
}

export const JOB_QUEUE = Symbol('JOB_QUEUE');
