/**
 * INDOBID — RAZORPAY PAYMENT PROVIDER IMPLEMENTATION
 */

import {
  IPaymentProvider,
  CreateOrderParams,
  PaymentOrder,
  VerifySignatureParams,
  VerifyWebhookParams,
} from '../payment.provider.interface';
import { createRazorpayOrder } from './orders';
import { verifyRazorpaySignature } from './verification';
import { verifyRazorpayWebhookSignature } from './webhooks';

export class RazorpayProvider implements IPaymentProvider {
  async createOrder(params: CreateOrderParams): Promise<PaymentOrder> {
    return createRazorpayOrder(params);
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    return verifyRazorpaySignature(params);
  }

  verifyWebhookSignature(params: VerifyWebhookParams): boolean {
    return verifyRazorpayWebhookSignature(params);
  }
}

export const razorpayProvider = new RazorpayProvider();
