/**
 * INDOBID — RAZORPAY ORDERS API
 */

import { CreateOrderParams, PaymentOrder } from '../payment.provider.interface';
import { getRazorpayConfig } from './client';
import { PaymentError } from '../../../lib/errors';

export async function createRazorpayOrder(params: CreateOrderParams): Promise<PaymentOrder> {
  const { keyId, keySecret } = getRazorpayConfig();

  if (!keyId || !keySecret) {
    // In local dev/test without credentials, return mock order
    return {
      id: `order_mock_${Date.now()}`,
      amount: params.amountPaise,
      currency: params.currency || 'INR',
      receipt: params.receipt,
      status: 'created',
    };
  }

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new PaymentError(data.error?.description || 'Failed to create Razorpay order');
  }

  return {
    id: data.id,
    amount: data.amount,
    currency: data.currency,
    receipt: data.receipt,
    status: data.status,
  };
}
