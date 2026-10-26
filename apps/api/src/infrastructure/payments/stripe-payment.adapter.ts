import { Injectable, Logger } from '@nestjs/common';
import {
  CreatePaymentLinkArgs,
  IPaymentProvider,
  PaymentIntent,
} from '../../domain/payments/payment.port';
import { LLMError } from '../../shared/errors/domain.errors';

interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
}

/**
 * Adapter Stripe - genera links de pago (Checkout Session) para anticipos.
 * DocumentaciÃ³n: https://stripe.com/docs/api/checkout/sessions
 */
@Injectable()
export class StripePaymentAdapter implements IPaymentProvider {
  readonly providerName = 'stripe' as const;
  private readonly logger = new Logger(StripePaymentAdapter.name);
  private readonly baseUrl = 'https://api.stripe.com/v1';

  constructor(private readonly config: StripeConfig) {}

  async createPaymentLink(args: CreatePaymentLinkArgs): Promise<PaymentIntent> {
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', args.successUrl ?? 'https://example.com/success');
    params.append('cancel_url', args.cancelUrl ?? 'https://example.com/cancel');
    params.append('client_reference_id', args.appointmentId);
    params.append('payment_intent_data[metadata][appointment_id]', args.appointmentId);
    params.append('payment_intent_data[metadata][patient_id]', args.patientId);
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', (args.currency ?? 'usd').toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(args.amountCents));
    params.append('line_items[0][price_data][product_data][name]', args.description);
    params.append('expires_at', String(Math.floor(Date.now() / 1000) + (args.expiresInMinutes ?? 60) * 60));

    const res = await fetch(`${this.baseUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': args.idempotencyKey,
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LLMError(`Stripe error: ${text}`, 'stripe');
    }

    const data = (await res.json()) as any;
    return {
      id: data.id,
      url: data.url,
      amountCents: args.amountCents,
      currency: args.currency ?? 'usd',
      expiresAt: new Date((data.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000),
      metadata: { appointmentId: args.appointmentId, patientId: args.patientId },
    };
  }

  async parseWebhook(payload: unknown, signature: string | null): Promise<{
    eventType: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled';
    intentId: string;
    appointmentId?: string;
  }> {
    // VerificaciÃ³n con stripe.webhooks.constructEvent requiere SDK.
    // AquÃ­ asumimos que el controller ya validÃ³ la firma (configuraciÃ³n).
    const ev = payload as any;
    const type = ev.type as string;
    const obj = ev.data?.object;
    const appointmentId = obj?.metadata?.appointment_id;

    if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
      return { eventType: 'payment.succeeded', intentId: obj.id, appointmentId };
    }
    if (type === 'payment_intent.payment_failed') {
      return { eventType: 'payment.failed', intentId: obj.id, appointmentId };
    }
    if (type === 'checkout.session.expired' || type === 'payment_intent.canceled') {
      return { eventType: 'payment.cancelled', intentId: obj.id, appointmentId };
    }
    throw new Error(`Unhandled Stripe event type: ${type}`);
  }

  async isHealthy(): Promise<boolean> {
    return !!this.config.secretKey;
  }
}
