/**
 * INDOBID — RAZORPAY PAYMENT ADAPTER
 * Adapts Razorpay gateway to generic IPaymentProvider interface, isolating external provider calls.
 */

import crypto from 'crypto';
import {
  IPaymentProvider,
  CreateOrderParams,
  PaymentOrder,
  VerifySignatureParams,
  VerifyWebhookParams,
} from './payment.provider.interface';
import { env } from '../../config/env';

export interface CheckoutSessionOptions {
  debateId?: string;
  contributionId?: string;
  title?: string;
  amountPaise: number;
  authorUsername?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  provider: 'razorpay';
  checkoutUrl?: string;
}

export class RazorpayAdapter implements IPaymentProvider {
  private get keyId(): string {
    return env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID?.trim() || '';
  }

  private get keySecret(): string {
    return env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  }

  private get webhookSecret(): string {
    return env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  }

  async createOrder(params: CreateOrderParams): Promise<PaymentOrder> {
    const currency = (params.currency || 'INR').toUpperCase();
    const receipt = (params.receipt || `rcpt_${Date.now()}`).substring(0, 40);

    if (!this.keyId || !this.keySecret) {
      const dummyId = `order_${receipt.substring(0, 14)}`;
      return {
        id: dummyId,
        amount: params.amountPaise,
        currency,
        receipt,
        status: 'created',
      };
    }

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
    const payload = {
      amount: params.amountPaise,
      currency,
      receipt,
      notes: params.notes || {},
    };

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Razorpay order creation failed: ${err.error?.description || res.statusText}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      receipt: data.receipt,
      status: data.status,
    };
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const receiptId = (options.contributionId || options.debateId || `rcpt_${Date.now()}`).substring(0, 40);
    const order = await this.createOrder({
      amountPaise: options.amountPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        debateId: options.debateId || '',
        contributionId: options.contributionId || '',
        authorUsername: options.authorUsername || 'anonymous',
        title: (options.title || '').substring(0, 100),
      },
    });

    return {
      sessionId: order.id,
      orderId: order.id,
      keyId: this.keyId || 'rzp_test_placeholder',
      amount: order.amount,
      currency: order.currency,
      provider: 'razorpay',
      checkoutUrl: options.successUrl ? `${options.successUrl}&session_id=${order.id}` : undefined,
    };
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    if (!this.keySecret) return false;
    try {
      const generatedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(`${params.orderId}|${params.paymentId}`)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(params.signature),
        Buffer.from(generatedSignature)
      );
    } catch {
      return false;
    }
  }

  verifyWebhookSignature(params: VerifyWebhookParams): boolean {
    if (!this.webhookSecret) return false;
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(params.body)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(params.signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
}

export const razorpayAdapter = new RazorpayAdapter();
