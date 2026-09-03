/**
 * INDOBID — PAYMENT SERVICE
 * Manages checkout order creation, signature verification, and atomic transactional fulfillment.
 */

import { razorpayAdapter, CheckoutSessionOptions, CheckoutSessionResult } from '../../infrastructure/payments/razorpay.adapter';
import { processSuccessfulPayment, FulfillmentParams, FulfillmentResult } from '../../lib/payments/fulfillment';
import { CreateCheckoutDTO, VerifyPaymentDTO } from './payment.types';
import { PaymentError, ValidationError } from '../../lib/errors';
import { appConfig } from '../../config/app';

export class PaymentService {
  async createCheckoutOrder(dto: CreateCheckoutDTO, userId: string) {
    if (dto.amountPaise < appConfig.money.MINIMUM_DEBATE_PAISE) {
      throw new ValidationError(`Minimum paid backing is $${appConfig.money.MINIMUM_DEBATE_PAISE / 100}.00`);
    }

    const order = await razorpayAdapter.createOrder({
      amountPaise: dto.amountPaise,
      currency: appConfig.money.DEFAULT_CURRENCY,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId,
        debateId: dto.debateId || '',
        isNewDebate: String(dto.isNewDebate || false),
      },
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || '',
    };
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    return razorpayAdapter.createCheckoutSession(options);
  }

  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    return razorpayAdapter.verifyPaymentSignature(params);
  }

  verifyWebhookSignature(params: { body: string; signature: string }): boolean {
    return razorpayAdapter.verifyWebhookSignature(params);
  }

  async processSuccessfulPayment(params: FulfillmentParams): Promise<FulfillmentResult> {
    return processSuccessfulPayment(params);
  }
}

export const paymentService = new PaymentService();
