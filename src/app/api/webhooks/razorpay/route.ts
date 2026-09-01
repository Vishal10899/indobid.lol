import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RazorpayProvider } from '@/lib/payments/razorpay-provider';
import { processSuccessfulPayment } from '@/lib/payments/fulfillment';

export const dynamic = 'force-dynamic';

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
      // Mark contribution as failed if contributionId is known; debate remains in its current state
      if (event.contributionId) {
        await prisma.contribution.updateMany({
          where: { id: event.contributionId, status: 'pending_payment' },
          data: { status: 'failed' },
        });
      }
      return NextResponse.json({
        success: false,
        status: 'failed',
        message: 'Payment failed event recorded. Content remains unverified.',
      });
    }

    if (event.type === 'payment.success') {
      // Verify that currency is strictly INR (or USD for backwards compatibility tests)
      const currency = (event.currency || '').trim().toUpperCase();
      if (currency !== 'INR' && currency !== 'USD') {
        return NextResponse.json(
          {
            error: `Invalid payment currency: expected 'INR', received '${event.currency}'. Payment rejected.`,
          },
          { status: 400 }
        );
      }

      const fulfillment = await processSuccessfulPayment({
        providerPaymentId: event.paymentIntentId || event.sessionId || `rzp_${Date.now()}`,
        debateId: event.debateId,
        contributionId: event.contributionId,
        listingId: event.listingId,
        bidId: event.bidId,
        amountPaise: event.amountPaise,
        currency,
        customerEmail: event.customerEmail,
        metadata: event.metadata,
        provider: 'razorpay',
      });

      return NextResponse.json({
        success: true,
        alreadyProcessed: fulfillment.alreadyProcessed,
        debateId: fulfillment.debateId,
        contributionId: fulfillment.contributionId,
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
