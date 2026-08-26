import { NextRequest, NextResponse } from 'next/server';
import { RazorpayProvider } from '@/lib/payments/razorpay-provider';
import { processSuccessfulPayment } from '@/lib/payments/fulfillment';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing Razorpay signature header' }, { status: 400 });
    }

    const provider = new RazorpayProvider();
    const event = await provider.verifyWebhookEvent(rawBody, signature);

    if (!event) {
      return NextResponse.json({ error: 'Invalid webhook signature or unrecognized event' }, { status: 400 });
    }

    if (event.type === 'payment.success') {
      const fulfillment = await processSuccessfulPayment({
        providerPaymentId: event.paymentIntentId || event.sessionId || `rzp_${Date.now()}`,
        listingId: event.listingId,
        bidId: event.bidId,
        amountCents: event.amountCents,
        currency: event.currency,
        customerEmail: event.customerEmail,
        metadata: event.metadata,
        provider: 'razorpay',
      });

      return NextResponse.json({
        success: true,
        alreadyProcessed: fulfillment.alreadyProcessed,
        listingId: fulfillment.listingId,
        newRank: fulfillment.newRank,
      });
    }

    return NextResponse.json({ received: true, ignored: true });
  } catch (error) {
    console.error('Razorpay Webhook handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal webhook processing error' },
      { status: 500 }
    );
  }
}
