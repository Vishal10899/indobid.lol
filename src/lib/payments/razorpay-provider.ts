import crypto from 'crypto';
import { PaymentProvider, CreateCheckoutParams, CheckoutSessionResult, WebhookEventPayload } from './payment-provider';

export class RazorpayProvider implements PaymentProvider {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const orderCurrency = 'INR';
    const amountPaise = params.amountPaise || params.chargeAmountCents || 1000;
    const receiptId = (params.contributionId || params.debateId || params.bidId || `rcpt_${Date.now()}`).substring(0, 40);

    if (!this.keyId || !this.keySecret) {
      // In local development / test mode when Razorpay keys are not configured
      const dummyOrderId = `order_${receiptId.substring(0, 14)}`;
      return {
        sessionId: dummyOrderId,
        orderId: dummyOrderId,
        keyId: this.keyId || 'rzp_test_placeholder',
        amount: amountPaise,
        currency: orderCurrency,
        provider: 'razorpay',
        checkoutUrl: params.successUrl ? `${params.successUrl}&session_id=${dummyOrderId}` : undefined,
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
      const payload = {
        amount: amountPaise, // amount in smallest currency unit (INR paise: e.g. 1000 for ₹10)
        currency: orderCurrency,
        receipt: receiptId,
        notes: {
          debateId: params.debateId || '',
          contributionId: params.contributionId || '',
          listingId: params.listingId || '',
          bidId: params.bidId || '',
          authorUsername: params.authorUsername || 'anonymous',
          title: (params.title || '').substring(0, 100),
        },
      };

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Razorpay Order creation failed: ${errorData.error?.description || response.statusText}`
        );
      }

      const order = await response.json();
      return {
        sessionId: order.id,
        orderId: order.id,
        keyId: this.keyId,
        amount: amountPaise,
        currency: order.currency ? order.currency.toUpperCase() : orderCurrency,
        provider: 'razorpay',
        checkoutUrl: params.successUrl ? `${params.successUrl}&session_id=${order.id}` : undefined,
      };
    } catch (error) {
      console.error('Razorpay createCheckoutSession error:', error);
      throw error;
    }
  }

  /**
   * Verifies Razorpay checkout payment signature (from client payment callback)
   * signature = hmac_sha256(order_id + "|" + payment_id, secret)
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.keySecret) {
      // If secret is not set in dev/test, allow test signatures
      return process.env.NODE_ENV !== 'production';
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Verifies Razorpay Webhook Event with HMAC-SHA256 signature
   */
  async verifyWebhookEvent(
    rawBody: string | Buffer,
    signature: string
  ): Promise<WebhookEventPayload | null> {
    if (!this.webhookSecret) {
      // In development/test mode without webhook secret
      if (process.env.NODE_ENV !== 'production') {
        try {
          const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
          const event = JSON.parse(bodyString);
          return this.parseWebhookPayload(event);
        } catch {
          return null;
        }
      }
      throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured on server');
    }

    const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(bodyString)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('Razorpay Webhook signature verification failed');
      return null;
    }

    try {
      const event = JSON.parse(bodyString);
      return this.parseWebhookPayload(event);
    } catch (err) {
      console.error('Failed to parse Razorpay webhook payload:', err);
      return null;
    }
  }

  private parseWebhookPayload(event: any): WebhookEventPayload | null {
    const eventType = event.event;

    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const notes = orderEntity?.notes || paymentEntity?.notes || {};
      const eventCurrency = (paymentEntity?.currency || orderEntity?.currency || 'INR').toUpperCase();

      return {
        type: 'payment.success',
        sessionId: orderEntity?.id,
        paymentIntentId: paymentEntity?.id || event.payload?.payment?.entity?.id,
        debateId: notes.debateId,
        contributionId: notes.contributionId,
        listingId: notes.listingId,
        bidId: notes.bidId,
        amountPaise: paymentEntity?.amount || orderEntity?.amount || 0,
        currency: eventCurrency,
        customerEmail: paymentEntity?.email,
        metadata: notes,
        rawEvent: event,
      };
    }

    if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const notes = orderEntity?.notes || paymentEntity?.notes || {};
      const eventCurrency = (paymentEntity?.currency || orderEntity?.currency || 'INR').toUpperCase();

      return {
        type: 'payment.failed',
        sessionId: orderEntity?.id,
        paymentIntentId: paymentEntity?.id || event.payload?.payment?.entity?.id,
        debateId: notes.debateId,
        contributionId: notes.contributionId,
        listingId: notes.listingId,
        bidId: notes.bidId,
        amountPaise: paymentEntity?.amount || orderEntity?.amount || 0,
        currency: eventCurrency,
        customerEmail: paymentEntity?.email,
        metadata: notes,
        rawEvent: event,
      };
    }

    return null;
  }
}

export const razorpayProvider = new RazorpayProvider();
