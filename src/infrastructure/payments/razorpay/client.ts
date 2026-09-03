/**
 * INDOBID — RAZORPAY CLIENT
 */

import { env } from '../../../config/env';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export function getRazorpayConfig(): RazorpayConfig {
  return {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  };
}

export function isRazorpayConfigured(): boolean {
  const config = getRazorpayConfig();
  return Boolean(config.keyId && config.keySecret);
}
