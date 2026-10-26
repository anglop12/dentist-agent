import { Module } from '@nestjs/common';
import { JOB_QUEUE } from '../../domain/jobs/job-queue.port';
import { SqliteJobQueue } from '../../infrastructure/database/repositories/sqlite-job.repository';
import { InProcessWorker } from '../../infrastructure/jobs/in-process.worker';
import { JobHandlers } from '../../infrastructure/jobs/job-handlers';
import { APPOINTMENT_REPOSITORY } from '../../domain/scheduling/repositories';
import { SqliteAppointmentRepository } from '../../infrastructure/database/repositories/sqlite-appointment.repository';
import { IdentityModule } from '../identity/identity.module';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [IdentityModule, SchedulingModule],
  providers: [
    { provide: JOB_QUEUE, useClass: SqliteJobQueue },
    { provide: APPOINTMENT_REPOSITORY, useClass: SqliteAppointmentRepository },
    InProcessWorker,
    JobHandlers,
  ],
  exports: [JOB_QUEUE, InProcessWorker, JobHandlers],
})
export class JobsModule {}
