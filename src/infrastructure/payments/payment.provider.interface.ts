/**
 * INDOBID — PAYMENT PROVIDER INTERFACE
 * Abstraction enabling vendor-agnostic payment gateways (Razorpay, Stripe, etc.)
 */

export interface CreateOrderParams {
  amountPaise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface VerifyWebhookParams {
  body: string;
  signature: string;
}

export interface IPaymentProvider {
  createOrder(params: CreateOrderParams): Promise<PaymentOrder>;
  verifyPaymentSignature(params: VerifySignatureParams): boolean;
  verifyWebhookSignature(params: VerifyWebhookParams): boolean;
}
