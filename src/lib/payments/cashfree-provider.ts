import { CreateCheckoutParams, CheckoutSessionResult, PaymentProvider, WebhookEventPayload } from './payment-provider';

export class CashfreePaymentProvider implements PaymentProvider {
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    throw new Error('Cashfree is deprecated. Use Razorpay provider on IndoBid.');
  }

  async verifyWebhookEvent(rawBody: string | Buffer, signature: string, timestamp?: string): Promise<WebhookEventPayload | null> {
    return null;
  }
}
