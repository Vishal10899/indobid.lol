/**
 * INDOBID — RAZORPAY SIGNATURE VERIFICATION
 */

import crypto from 'crypto';
import { VerifySignatureParams } from '../payment.provider.interface';
import { getRazorpayConfig } from './client';

export function verifyRazorpaySignature(params: VerifySignatureParams): boolean {
  const { orderId, paymentId, signature } = params;
  const { keySecret } = getRazorpayConfig();

  if (!keySecret || !orderId || !paymentId || !signature) {
    // In local non-production development/test environments without credentials
    if (process.env.NODE_ENV !== 'production' && orderId?.startsWith('order_mock_')) return true;
    return false;
  }

  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');

  if (signature.length !== expectedSignature.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
