/**
 * Worker en proceso - lee jobs vencidos de la cola SQLite y los ejecuta.
 * Se monta en el API process (con NestJS @nestjs/schedule) o en un proceso
 * separado (apps/worker).
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IJobQueue } from '../../domain/jobs/job-queue.port';
import { JOB_QUEUE } from '../../domain/jobs/job-queue.port';
import { Inject } from '@nestjs/common';
import { loadEnv } from '../../config/env';

export type JobHandler = (payload: any) => Promise<void>;

@Injectable()
export class InProcessWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InProcessWorker.name);
  private readonly handlers = new Map<string, JobHandler>();
  private running = false;
  private loopPromise?: Promise<void>;
  private intervalHandle?: NodeJS.Timeout;

  constructor(@Inject(JOB_QUEUE) private readonly queue: IJobQueue) {}

  onModuleInit(): void {
    const env = loadEnv();
    if (env.NODE_ENV === 'test') return;
    // Pequeño delay para asegurar que la BD esté migrada antes de empezar.
    setTimeout(() => this.start(), 1000);
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  registerHandler(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const env = loadEnv();
    this.intervalHandle = setInterval(() => this.tick(), env.JOB_POLL_INTERVAL_MS);
    this.loopPromise = this.run();
    this.logger.log(`Worker started (poll ${env.JOB_POLL_INTERVAL_MS}ms)`);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    if (this.loopPromise) await this.loopPromise;
    this.logger.log('Worker stopped');
  }

  private async run(): Promise<void> {
    while (this.running) {
      try {
        await this.tick();
      } catch (e) {
        this.logger.error(`Worker tick error: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  private async tick(): Promise<void> {
    const job = await this.queue.claimDue(new Date());
    if (!job) return;
    const handler = this.handlers.get(job.name);
    if (!handler) {
      this.logger.warn(`No handler for job ${job.name}, marking failed`);
      await this.queue.markFailed(job.id, `No handler registered for ${job.name}`);
      return;
    }
    try {
      await handler(job.payload);
      await this.queue.markDone(job.id);
    } catch (e) {
      this.logger.error(`Job ${job.name} (${job.id}) failed: ${(e as Error).message}`);
      await this.queue.markFailed(job.id, (e as Error).message);
    }
  }
}
