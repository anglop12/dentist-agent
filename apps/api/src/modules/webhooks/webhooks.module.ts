import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { AuditLogger } from '../../infrastructure/observability/audit-logger';

@Module({
  controllers: [WebhookController],
  providers: [AuditLogger],
  exports: [AuditLogger],
})
export class WebhooksModule {}
