import { Injectable, Logger } from '@nestjs/common';
import {
  CreatePaymentLinkArgs,
  IPaymentProvider,
  PaymentIntent,
} from '../../domain/payments/payment.port';

interface MercadoPagoConfig {
  accessToken: string;
}

/**
 * Adapter MercadoPago - genera preferences de pago (link) para anticipos.
 */
@Injectable()
export class MercadoPagoPaymentAdapter implements IPaymentProvider {
  readonly providerName = 'mercadopago' as const;
  private readonly logger = new Logger(MercadoPagoPaymentAdapter.name);
  private readonly baseUrl = 'https://api.mercadopago.com';

  constructor(private readonly config: MercadoPagoConfig) {}

  async createPaymentLink(args: CreatePaymentLinkArgs): Promise<PaymentIntent> {
    const res = await fetch(`${this.baseUrl}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': args.idempotencyKey,
      },
      body: JSON.stringify({
        items: [
          {
            title: args.description,
            quantity: 1,
            unit_price: args.amountCents / 100,
            currency_id: (args.currency ?? 'ARS').toUpperCase(),
          },
        ],
        external_reference: args.appointmentId,
        metadata: { appointment_id: args.appointmentId, patient_id: args.patientId },
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(
          Date.now() + (args.expiresInMinutes ?? 60) * 60_000,
        ).toISOString(),
        back_urls: {
          success: args.successUrl ?? 'https://example.com/success',
          failure: args.cancelUrl ?? 'https://example.com/cancel',
          pending: args.cancelUrl ?? 'https://example.com/pending',
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`MercadoPago error: ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    return {
      id: String(data.id),
      url: data.init_point ?? data.sandbox_init_point,
      amountCents: args.amountCents,
      currency: args.currency ?? 'ARS',
      expiresAt: new Date(Date.now() + (args.expiresInMinutes ?? 60) * 60_000),
      metadata: { appointmentId: args.appointmentId, patientId: args.patientId },
    };
  }

  async parseWebhook(payload: unknown, _signature: string | null): Promise<{
    eventType: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled';
    intentId: string;
    appointmentId?: string;
  }> {
    const ev = payload as any;
    if (ev.type === 'payment' && ev.data?.id) {
      // En producciÃ³n, fetch del payment para verificar estado.
      return {
        eventType: 'payment.succeeded',
        intentId: String(ev.data.id),
        appointmentId: ev.data.external_reference ?? undefined,
      };
    }
    throw new Error(`Unhandled MP event type: ${ev.type}`);
  }

  async isHealthy(): Promise<boolean> {
    return !!this.config.accessToken;
  }
}
