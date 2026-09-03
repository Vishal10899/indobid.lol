/**
 * INDOBID — RAZORPAY WEBHOOK VERIFICATION
 */

import crypto from 'crypto';
import { VerifyWebhookParams } from '../payment.provider.interface';
import { getRazorpayConfig } from './client';

export function verifyRazorpayWebhookSignature(params: VerifyWebhookParams): boolean {
  const { body, signature } = params;
  const { webhookSecret } = getRazorpayConfig();

  if (!webhookSecret || !body || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  if (signature.length !== expectedSignature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
