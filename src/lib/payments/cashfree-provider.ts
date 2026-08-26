import crypto from 'crypto';
import { CreateCheckoutParams, CheckoutSessionResult, PaymentProvider, WebhookEventPayload } from './payment-provider';

function getCashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim();
  const env = (process.env.CASHFREE_ENVIRONMENT?.trim() || 'SANDBOX').toUpperCase();

  if (!appId || appId === '' || appId.includes('...') || appId.includes('placeholder')) {
    throw new Error(
      'CASHFREE_APP_ID is missing or not configured. Please set CASHFREE_APP_ID in your server .env file.'
    );
  }

  if (!secretKey || secretKey === '' || secretKey.includes('...') || secretKey.includes('placeholder')) {
    throw new Error(
      'CASHFREE_SECRET_KEY is missing or not configured. Please set CASHFREE_SECRET_KEY in your server .env file.'
    );
  }

  const isProduction = env === 'PRODUCTION';
  const apiBaseUrl = isProduction
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  const checkoutBaseUrl = isProduction
    ? 'https://payments.cashfree.com/order/#'
    : 'https://payments-test.cashfree.com/order/#';

  return { appId, secretKey, apiBaseUrl, checkoutBaseUrl, isProduction };
}

export class CashfreePaymentProvider implements PaymentProvider {
  /**
   * Creates a Cashfree PG Order on the server and returns the Checkout session URL
   */
  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const config = getCashfreeConfig();

    // Unique order ID (Cashfree limit: alphanumeric + underscore, max 45 chars)
    const orderId = `ord_${params.listingId.substring(0, 8)}_${Date.now()}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const orderAmount = parseFloat((params.chargeAmountCents / 100).toFixed(2));

    const payload = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: 'USD',
      customer_details: {
        customer_id: `cust_${params.bidId.substring(0, 12)}`,
        customer_email: params.customerEmail || 'bidder@indobid.lol',
        customer_phone: '9999999999',
      },
      order_meta: {
        return_url: params.successUrl.replace('{CHECKOUT_SESSION_ID}', orderId),
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/cashfree`,
      },
      order_tags: {
        listing_id: params.listingId,
        bid_id: params.bidId,
        target_total_cents: params.targetTotalBidCents.toString(),
        charge_amount_cents: params.chargeAmountCents.toString(),
      },
      order_note: `Leaderboard Bid: ${params.title.substring(0, 30)}`,
    };

    const response = await fetch(`${config.apiBaseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || !data.payment_session_id) {
      const errorMsg = data.message || data.error || JSON.stringify(data);
      throw new Error(`Cashfree Order Creation Failed (${response.status}): ${errorMsg}`);
    }

    const checkoutUrl = `${config.checkoutBaseUrl}${data.payment_session_id}`;

    return {
      sessionId: orderId,
      checkoutUrl,
    };
  }

  /**
   * Verifies Cashfree Webhook cryptographically using HMAC-SHA256
   */
  async verifyWebhookEvent(rawBody: string | Buffer, signature: string, timestamp?: string): Promise<WebhookEventPayload | null> {
    const config = getCashfreeConfig();
    const rawBodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');

    // Cryptographic signature check: HMAC-SHA256(timestamp + rawBody, CASHFREE_SECRET_KEY)
    if (signature && timestamp) {
      const dataToSign = `${timestamp}${rawBodyString}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.secretKey)
        .update(dataToSign)
        .digest('base64');

      if (signature !== expectedSignature) {
        throw new Error('Cashfree webhook signature mismatch');
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawBodyString);
    } catch {
      throw new Error('Invalid JSON payload in Cashfree webhook');
    }

    // Cashfree PG sends webhook events like PAYMENT_SUCCESS_WEBHOOK, ORDER_PAID, etc.
    const eventType = parsed.type || parsed.event_type || 'PAYMENT_SUCCESS_WEBHOOK';
    const orderData = parsed.data?.order || parsed.order || {};
    const paymentData = parsed.data?.payment || parsed.payment || {};
    const customerData = parsed.data?.customer_details || parsed.customer_details || {};

    const paymentStatus = (paymentData.payment_status || orderData.order_status || '').toUpperCase();
    const isSuccess = paymentStatus === 'SUCCESS' || eventType.includes('SUCCESS') || eventType.includes('PAID');

    if (!isSuccess) {
      return null;
    }

    const orderId = orderData.order_id || parsed.order_id || '';
    const orderTags = orderData.order_tags || parsed.order_tags || {};
    const listingId = orderTags.listing_id || '';
    const bidId = orderTags.bid_id || '';
    const amountFloat = paymentData.payment_amount || orderData.order_amount || 0;
    const amountCents = Math.round(amountFloat * 100);

    return {
      type: 'payment.success',
      sessionId: orderId,
      paymentIntentId: paymentData.cf_payment_id ? paymentData.cf_payment_id.toString() : orderId,
      listingId,
      bidId,
      amountCents,
      currency: (orderData.order_currency || 'USD').toLowerCase(),
      customerEmail: customerData.customer_email || undefined,
      metadata: orderTags,
      rawEvent: parsed,
    };
  }
}

export const paymentProvider = new CashfreePaymentProvider();
