import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { AgentGateway } from './agent.gateway';
import { AgentOrchestrator } from './agent.orchestrator';
import { PlannerService } from './planner.service';
import { ExecutorService } from './executor.service';
import { ConversationMemory } from './conversation-memory';
import { EventListeners } from './event-listeners';
import { ProcessIncomingMessageUseCase } from './use-cases/process-incoming-message.usecase';
import {
  CONVERSATION_REPOSITORY,
  MESSAGE_REPOSITORY,
} from '../../domain/conversation/repositories';
import {
  SqliteConversationRepository,
  SqliteMessageRepository,
} from '../../infrastructure/database/repositories/sqlite-conversation.repository';
import { TOOL_REGISTRY } from '../../domain/intelligence/tool';
import { ToolRegistry } from '../../domain/intelligence/tool';
import { ConversationFSM } from '../../domain/conversation/conversation-fsm';
import { IdentityModule } from '../identity/identity.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { AvailabilityModule } from '../availability/availability.module';
import { JobsModule } from '../communication/jobs.module';
import { ReportingModule } from '../reporting/reporting.module';
import { CLOCK, SystemClock } from '../../shared/utils/clock.util';
import { ChannelFactory } from '../communication/channel.factory';
import { CHANNEL_REGISTRY, ChannelRegistry } from '../communication/channel-registry';
import { BaileysWhatsAppChannel } from '../../infrastructure/channels/baileys-whatsapp.channel';
import { WebSocketChannel } from '../../infrastructure/channels/websocket.channel';

@Module({
  imports: [
    IdentityModule,
    SchedulingModule,
    AvailabilityModule,
    JobsModule,
    ReportingModule,
  ],
  controllers: [ConversationController],
  providers: [
    AgentOrchestrator,
    PlannerService,
    ExecutorService,
    ConversationMemory,
    EventListeners,
    ProcessIncomingMessageUseCase,
    { provide: TOOL_REGISTRY, useClass: ToolRegistry },
    { provide: CONVERSATION_REPOSITORY, useClass: SqliteConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: SqliteMessageRepository },
    ConversationFSM,
    AgentGateway,
    { provide: CLOCK, useClass: SystemClock },
    ChannelFactory,
    {
      provide: CHANNEL_REGISTRY,
      useFactory: (
        whatsapp: BaileysWhatsAppChannel,
        ws: WebSocketChannel,
      ): ChannelRegistry => {
        const r = new Map<string, any>();
        r.set('whatsapp', whatsapp);
        r.set('web', ws);
        return r;
      },
      inject: [BaileysWhatsAppChannel, WebSocketChannel],
    },
    BaileysWhatsAppChannel,
    WebSocketChannel,
  ],
  exports: [
    AgentOrchestrator,
    ProcessIncomingMessageUseCase,
    PlannerService,
    ExecutorService,
    ConversationMemory,
  ],
})
export class ConversationModule {}
