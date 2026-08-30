import crypto from 'crypto';
import { PaymentProvider, CreateCheckoutParams, CheckoutSessionResult, WebhookEventPayload } from './payment-provider';

export class RazorpayProvider implements PaymentProvider {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private currency: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
    this.currency = (process.env.RAZORPAY_CURRENCY?.trim() || 'INR').toUpperCase();
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const orderCurrency = 'INR';
    if (!this.keyId || !this.keySecret) {
      // In development / demo mode when Razorpay keys are not provided
      const dummyOrderId = `order_${params.bidId.substring(0, 14)}`;
      return {
        sessionId: dummyOrderId,
        orderId: dummyOrderId,
        keyId: this.keyId || 'rzp_test_placeholder',
        amount: params.chargeAmountCents,
        currency: orderCurrency,
        provider: 'razorpay',
        checkoutUrl: `${params.successUrl}&session_id=${dummyOrderId}`,
      };
    }

    try {
      const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
      const payload = {
        amount: params.chargeAmountCents, // amount in smallest currency unit (paise: e.g. 200 for ₹2)
        currency: orderCurrency,
        receipt: params.bidId.substring(0, 40),
        notes: {
          listingId: params.listingId,
          bidId: params.bidId,
          targetTotalBidCents: params.targetTotalBidCents.toString(),
          canonicalUrl: params.canonicalUrl,
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
        amount: params.chargeAmountCents,
        currency: order.currency ? order.currency.toUpperCase() : orderCurrency,
        provider: 'razorpay',
        checkoutUrl: `${params.successUrl}&session_id=${order.id}`,
      };
    } catch (error) {
      console.error('Razorpay createCheckoutSession error:', error);
      throw error;
    }
  }

  async verifyWebhookEvent(
    rawBody: string | Buffer,
    signature: string
  ): Promise<WebhookEventPayload | null> {
    if (!this.webhookSecret) {
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
          listingId: notes.listingId,
          bidId: notes.bidId,
          amountCents: paymentEntity?.amount || orderEntity?.amount,
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
          listingId: notes.listingId,
          bidId: notes.bidId,
          amountCents: paymentEntity?.amount || orderEntity?.amount || 0,
          currency: eventCurrency,
          customerEmail: paymentEntity?.email,
          metadata: notes,
          rawEvent: event,
        };
      }

      return null;
    } catch (err) {
      console.error('Failed to parse Razorpay webhook payload:', err);
      return null;
    }
  }
}

export const razorpayProvider = new RazorpayProvider();
