export interface CreateDebateCheckoutParams {
  debateId: string;
  contributionId?: string;
  title: string;
  amountPaise: number;
  authorUsername: string;
  customerEmail?: string;
  isNewDebate?: boolean;
}

export interface CreateCheckoutParams {
  listingId?: string;
  bidId?: string;
  debateId?: string;
  contributionId?: string;
  title: string;
  chargeAmountCents?: number;
  amountPaise?: number;
  targetTotalBidCents?: number;
  canonicalUrl?: string;
  authorUsername?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl?: string;
  orderId?: string;
  keyId?: string;
  amount?: number;
  currency?: string;
  provider?: string;
}

export interface WebhookEventPayload {
  type: string;
  sessionId?: string;
  paymentIntentId?: string;
  debateId?: string;
  contributionId?: string;
  listingId?: string;
  bidId?: string;
  amountPaise: number;
  currency: string;
  customerEmail?: string;
  metadata: Record<string, string>;
  rawEvent: unknown;
}

export interface PaymentProvider {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;
  verifyWebhookEvent(rawBody: string | Buffer, signature: string, timestamp?: string): Promise<WebhookEventPayload | null>;
}
