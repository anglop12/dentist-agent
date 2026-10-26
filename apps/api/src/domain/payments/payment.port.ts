/**
 * Puerto de pagos (intercambiable: Stripe / MercadoPago).
 */

export interface PaymentIntent {
  id: string;
  url: string;
  amountCents: number;
  currency: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentLinkArgs {
  amountCents: number;
  currency?: string;
  description: string;
  appointmentId: string;
  patientId: string;
  successUrl?: string;
  cancelUrl?: string;
  expiresInMinutes?: number;
  idempotencyKey: string;
}

export interface IPaymentProvider {
  readonly providerName: 'stripe' | 'mercadopago';
  createPaymentLink(args: CreatePaymentLinkArgs): Promise<PaymentIntent>;
  /** Valida y parsea un webhook entrante. */
  parseWebhook(payload: unknown, signature: string | null): Promise<{
    eventType: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled';
    intentId: string;
    appointmentId?: string;
  }>;
  isHealthy(): Promise<boolean>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
