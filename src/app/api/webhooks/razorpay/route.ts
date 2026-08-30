import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

    if (event.type === 'payment.failed') {
      // Mark bid as failed if bidId is known; listing remains pending_payment
      if (event.bidId) {
        await prisma.bid.updateMany({
          where: { id: event.bidId, status: 'pending' },
          data: { status: 'failed' },
        });
      }
      return NextResponse.json({
        success: false,
        status: 'failed',
        message: 'Payment failed event recorded. Listing remains inactive.',
      });
    }

    if (event.type === 'payment.success') {
      // Verify that currency is strictly USD
      const currency = (event.currency || '').trim().toUpperCase();
      if (currency !== 'USD') {
        return NextResponse.json(
          {
            error: `Invalid payment currency: expected 'USD', received '${event.currency}'. Payment rejected.`,
          },
          { status: 400 }
        );
      }

      const fulfillment = await processSuccessfulPayment({
        providerPaymentId: event.paymentIntentId || event.sessionId || `rzp_${Date.now()}`,
        listingId: event.listingId,
        bidId: event.bidId,
        amountCents: event.amountCents,
        currency: 'USD',
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
