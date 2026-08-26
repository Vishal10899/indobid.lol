export interface CreateCheckoutParams {
  listingId: string;
  bidId: string;
  title: string;
  chargeAmountCents: number;
  targetTotalBidCents: number;
  canonicalUrl: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

export interface WebhookEventPayload {
  type: string;
  sessionId?: string;
  paymentIntentId?: string;
  listingId: string;
  bidId: string;
  amountCents: number;
  currency: string;
  customerEmail?: string;
  metadata: Record<string, string>;
  rawEvent: unknown;
}

export interface PaymentProvider {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;
  verifyWebhookEvent(rawBody: string | Buffer, signature: string, timestamp?: string): Promise<WebhookEventPayload | null>;
}
