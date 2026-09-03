/**
 * INDOBID — PAYMENT MODULE TYPES
 */

export interface CreateCheckoutDTO {
  amountPaise: number;
  currency?: string;
  countryCode?: string;
  debateId?: string;
  isNewDebate?: boolean;
}

export interface VerifyPaymentDTO {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  debateId: string;
  argumentContent?: string;
  title?: string;
  categoryId?: string;
  isNewDebate?: boolean;
}

export interface FulfillPaymentResult {
  success: boolean;
  alreadyProcessed?: boolean;
  debateId?: string;
  error?: string;
}
