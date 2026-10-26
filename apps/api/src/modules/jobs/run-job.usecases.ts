import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InProcessWorker } from '../../infrastructure/jobs/in-process.worker';
import { JobHandlers, JOB_SEND_REMINDER_24H, JOB_SEND_REMINDER_2H, JOB_CANCEL_NO_SHOW } from '../../infrastructure/jobs/job-handlers';

/**
 * RunJobUseCases - registra los handlers de jobs en el InProcessWorker.
 * Separa la responsabilidad: JobHandlers tiene la lógica,
 * este wiring solo conecta los handlers al worker.
 */
@Injectable()
export class RunJobUseCases implements OnModuleInit {
  private readonly logger = new Logger(RunJobUseCases.name);

  constructor(
    private readonly worker: InProcessWorker,
    private readonly jobHandlers: JobHandlers,
  ) {}

  onModuleInit(): void {
    this.worker.registerHandler(JOB_SEND_REMINDER_24H, (p) => this.jobHandlers['handleReminder24h'](p));
    this.worker.registerHandler(JOB_SEND_REMINDER_2H, (p) => this.jobHandlers['handleReminder2h'](p));
    this.worker.registerHandler(JOB_CANCEL_NO_SHOW, (p) => this.jobHandlers['handleNoShow'](p));
    this.logger.log('Job handlers registered via RunJobUseCases');
  }
}
