import { Inject, Injectable, Logger } from '@nestjs/common';
import { IncomingMessage } from '../../../domain/communication/channel.port';
import { AgentOrchestrator } from '../agent.orchestrator';

/**
 * ProcessIncomingMessageUseCase - punto de entrada Ãºnico para mensajes
 * de cualquier canal. El controlador/gateway solo delega aquÃ­.
 *
 * Mantiene la responsabilidad: orquestar la entrada, no la lÃ³gica del agente.
 */
@Injectable()
export class ProcessIncomingMessageUseCase {
  private readonly logger = new Logger(ProcessIncomingMessageUseCase.name);

  constructor(private readonly orchestrator: AgentOrchestrator) {}

  async execute(msg: IncomingMessage): Promise<string> {
    this.logger.log(`Processing message from ${msg.channel}:${msg.externalId}`);
    return this.orchestrator.handleMessage(msg);
  }

  async *stream(msg: IncomingMessage): AsyncIterable<string> {
    yield* this.orchestrator.streamMessage(msg);
  }
}
