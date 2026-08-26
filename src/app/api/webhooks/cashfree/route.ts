import { NextRequest, NextResponse } from 'next/server';
import { paymentProvider } from '@/lib/payments/cashfree-provider';
import { processSuccessfulPayment } from '@/lib/payments/fulfillment';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-webhook-signature') || '';
    const timestamp = request.headers.get('x-webhook-timestamp') || undefined;

    let eventPayload;
    try {
      eventPayload = await paymentProvider.verifyWebhookEvent(rawBody, signature, timestamp);
    } catch (err) {
      console.error('Cashfree webhook signature verification failed:', err);
      return NextResponse.json(
        { error: `Webhook verification failed: ${err instanceof Error ? err.message : 'Unknown'}` },
        { status: 400 }
      );
    }

    if (!eventPayload) {
      // Ignored event or non-success status
      return NextResponse.json({ received: true, ignored: true });
    }

    const {
      sessionId,
      listingId,
      bidId,
      amountCents,
      currency,
      customerEmail,
      metadata,
    } = eventPayload;

    if (!sessionId || !listingId || amountCents <= 0) {
      console.error('Invalid payload fields in Cashfree webhook event:', eventPayload);
      return NextResponse.json({ error: 'Missing required payload fields' }, { status: 400 });
    }

    // Process payment idempotently
    const result = await processSuccessfulPayment({
      providerPaymentId: sessionId,
      listingId,
      bidId,
      amountCents,
      currency,
      customerEmail,
      metadata,
      provider: 'cashfree',
    });

    return NextResponse.json({
      received: true,
      success: result.success,
      alreadyProcessed: result.alreadyProcessed,
      listingId: result.listingId,
      newVerifiedBid: result.newVerifiedBid,
      newRank: result.newRank,
    });
  } catch (error) {
    console.error('Unhandled Cashfree webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook internal error' },
      { status: 500 }
    );
  }
}
