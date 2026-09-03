/**
 * INDOBID — PAYMENT VALIDATION
 */

import { z } from 'zod';
import { appConfig } from '../../config/app';

export const CreateCheckoutSchema = z.object({
  amountPaise: z
    .number()
    .int('Amount must be an integer')
    .min(appConfig.money.MINIMUM_DEBATE_PAISE, `Minimum support is $${appConfig.money.MINIMUM_DEBATE_PAISE / 100}.00`),
  debateId: z.string().optional(),
  isNewDebate: z.boolean().optional(),
});

export const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
  debateId: z.string().min(1, 'Debate ID is required'),
  argumentContent: z.string().optional(),
  title: z.string().optional(),
  categoryId: z.string().optional(),
  isNewDebate: z.boolean().optional(),
});
