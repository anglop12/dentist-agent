import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { JOB_QUEUE } from '../../domain/jobs/job-queue.port';
import { LLM_PROVIDER } from '../../domain/intelligence/llm.port';
import { DB_TOKEN } from '../../infrastructure/database/database.tokens';
import { SqliteJobQueue } from '../../infrastructure/database/repositories/sqlite-job.repository';

@Module({
  controllers: [HealthController],
  providers: [
    { provide: JOB_QUEUE, useClass: SqliteJobQueue },
    // LLM_PROVIDER y DB_TOKEN ya son globales.
  ],
})
export class HealthModule {}
