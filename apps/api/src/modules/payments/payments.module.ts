import { Module } from '@nestjs/common';
import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StripePaymentAdapter } from '../../infrastructure/payments/stripe-payment.adapter';
import { MercadoPagoPaymentAdapter } from '../../infrastructure/payments/mercadopago-payment.adapter';
import { PAYMENT_PROVIDER } from '../../domain/payments/payment.port';
import { Inject } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import { ChangeAppointmentStatusUseCase } from '../scheduling/use-cases/change-status.usecase';
import { SchedulingModule } from '../scheduling/scheduling.module';
import {
  APPOINTMENT_REPOSITORY,
  IAppointmentRepository,
} from '../../domain/scheduling/repositories';

@ApiTags('payments')
@Controller('webhooks/payments')
export class PaymentsWebhookController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: any,
    @Inject(APPOINTMENT_REPOSITORY) private readonly apptRepo: IAppointmentRepository,
    private readonly changeStatus: ChangeAppointmentStatusUseCase,
  ) {}

  @Post()
  async handle(
    @Body() body: any,
    @Headers('stripe-signature') stripeSig?: string,
    @Headers('x-signature') mpSig?: string,
  ): Promise<{ received: true }> {
    const sig = stripeSig ?? mpSig ?? null;
    const event = await this.provider.parseWebhook(body, sig);

    if (event.appointmentId && event.eventType === 'payment.succeeded') {
      const appt = await this.apptRepo.findById(event.appointmentId);
      if (appt) {
        await this.changeStatus.execute(appt.id, 'confirmed');
      }
    }

    return { received: true };
  }
}

@Module({
  imports: [SchedulingModule],
  controllers: [PaymentsWebhookController],
  providers: [
    ChangeAppointmentStatusUseCase,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () => {
        const env = loadEnv();
        if (env.STRIPE_ENABLED && env.STRIPE_SECRET_KEY) {
          return new StripePaymentAdapter({
            secretKey: env.STRIPE_SECRET_KEY,
            webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
          });
        }
        if (env.MERCADOPAGO_ENABLED && env.MERCADOPAGO_ACCESS_TOKEN) {
          return new MercadoPagoPaymentAdapter({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN });
        }
        // Stub que rechaza - se debe configurar un proveedor.
        return new (class {
          readonly providerName = 'stripe' as const;
          async createPaymentLink() { throw new Error('No payment provider configured'); }
          async parseWebhook() { throw new Error('No payment provider configured'); }
          async isHealthy() { return false; }
        })();
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
