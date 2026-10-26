import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditLogger } from '../../infrastructure/observability/audit-logger';

interface WebhookEnvelope {
  source: string;     // 'whatsapp' | 'stripe' | 'mercadopago' | 'custom'
  eventType: string;
  payload: unknown;
}

/**
 * WebhookController - receptor genérico de webhooks entrantes.
 * Normaliza el envelope y delega a handlers específicos.
 */
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly audit: AuditLogger) {}

  @Post('incoming')
  async handle(
    @Body() body: WebhookEnvelope,
    @Headers('x-webhook-signature') signature?: string,
  ): Promise<{ received: true }> {
    if (!body?.source || !body?.eventType) {
      throw new BadRequestException('Invalid webhook envelope');
    }

    await this.audit.log({
      actor: `webhook:${body.source}`,
      action: body.eventType,
      resource: 'webhook',
      resourceId: signature ?? undefined,
      payload: body.payload,
    });

    // Aquí se podrían delegar a handlers específicos según source/eventType.
    // Por ejemplo:
    //   if (body.source === 'whatsapp') await this.whatsappHandler.handle(body);
    //   if (body.source === 'stripe') await this.paymentsHandler.handle(body);

    return { received: true };
  }
}
