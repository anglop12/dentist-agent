import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { LlmModule } from './infrastructure/llm/llm.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { IdentityModule } from './modules/identity/identity.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { JobsModule } from './modules/communication/jobs.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthModule } from './modules/health/health.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    LlmModule,
    ObservabilityModule,
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 30 },
    ]),
    IdentityModule,
    SchedulingModule,
    AvailabilityModule,
    ConversationModule,
    JobsModule,
    PaymentsModule,
    ReportingModule,
    WebhooksModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
