import { NextRequest, NextResponse } from 'next/server';
import { razorpayProvider } from '@/lib/payments/razorpay-provider';
import { processSuccessfulPayment } from '@/lib/payments/fulfillment';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
  debateId: z.string().optional(),
  contributionId: z.string().optional(),
  amountPaise: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifyPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid payment verification parameters' },
        { status: 400 }
      );
    }

    const {
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_signature: signature,
      debateId,
      contributionId,
      amountPaise,
    } = parsed.data;

    // 1. Verify cryptographic HMAC SHA-256 signature
    const isValidSignature = razorpayProvider.verifyPaymentSignature(orderId, paymentId, signature);
    if (!isValidSignature) {
      console.error('Payment signature mismatch in client verify');
      return NextResponse.json(
        { error: 'Payment signature verification failed. Untrusted payment response.' },
        { status: 400 }
      );
    }

    // 2. Resolve expected debate and contribution details from DB
    let targetDebateId = debateId;
    let targetContributionId = contributionId;
    let expectedAmountPaise = amountPaise;

    if (contributionId) {
      const contrib = await prisma.contribution.findUnique({
        where: { id: contributionId },
        include: { debate: true },
      });
      if (contrib) {
        targetDebateId = contrib.debateId;
        expectedAmountPaise = contrib.amount;
      }
    } else if (debateId) {
      const debate = await prisma.debate.findUnique({ where: { id: debateId } });
      if (debate && debate.status === 'pending_payment') {
        expectedAmountPaise = debate.originalContribution;
      }
    }

    if (!targetDebateId) {
      return NextResponse.json({ error: 'Associated debate not found for payment' }, { status: 404 });
    }

    if (!expectedAmountPaise || expectedAmountPaise <= 0) {
      return NextResponse.json({ error: 'Valid expected amount could not be determined' }, { status: 400 });
    }

    // 3. Atomically fulfill payment
    const fulfillment = await processSuccessfulPayment({
      providerPaymentId: paymentId,
      debateId: targetDebateId,
      contributionId: targetContributionId,
      amountPaise: expectedAmountPaise,
      currency: 'INR',
      provider: 'razorpay',
    });

    return NextResponse.json({
      success: true,
      alreadyProcessed: fulfillment.alreadyProcessed,
      debateId: fulfillment.debateId,
      contributionId: fulfillment.contributionId,
      totalVerifiedContribution: fulfillment.totalVerifiedContribution,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal payment verification error' },
      { status: 500 }
    );
  }
}
