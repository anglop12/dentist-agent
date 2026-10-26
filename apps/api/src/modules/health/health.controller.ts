import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { LLM_PROVIDER } from '../../domain/intelligence/llm.port';
import { JOB_QUEUE } from '../../domain/jobs/job-queue.port';
import { DB_TOKEN } from '../../infrastructure/database/database.tokens';
import { MetricsCollector } from '../../infrastructure/observability/metrics';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(DB_TOKEN) private readonly db: any,
    @Inject(LLM_PROVIDER) private readonly llm: any,
    @Inject(JOB_QUEUE) private readonly queue: any,
    private readonly metrics: MetricsCollector,
  ) {}

  @Get('healthz')
  async healthz(): Promise<{
    status: string;
    uptime: number;
    db: boolean;
    llm: boolean;
    queue: { pending: number; running: number };
  }> {
    let dbOk = false;
    try {
      this.db.raw.prepare('SELECT 1').get();
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const llmOk = await this.llm.isHealthy().catch(() => false);

    const pending = await this.queue.listByStatus('pending').catch(() => []);
    const running = await this.queue.listByStatus('running').catch(() => []);

    return {
      status: dbOk && llmOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      db: dbOk,
      llm: llmOk,
      queue: { pending: pending.length, running: running.length },
    };
  }

  @Get('readyz')
  readyz(): { ready: true } {
    return { ready: true };
  }

  @Get('metrics')
  async prometheusMetrics(): Promise<string> {
    return this.metrics.serialize();
  }
}
