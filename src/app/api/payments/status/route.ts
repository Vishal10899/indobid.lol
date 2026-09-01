import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const debateId = searchParams.get('debate_id') || '';
    const contributionId = searchParams.get('contribution_id') || '';
    const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || '';
    const paymentId = searchParams.get('payment_id') || '';

    if (!debateId && !contributionId && !sessionId && !paymentId) {
      return NextResponse.json({ error: 'Identification parameter required' }, { status: 400 });
    }

    // 1. Check payment table by paymentId / sessionId
    let payment = null;
    if (paymentId) {
      payment = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentId },
        include: { debate: { include: { category: true } } },
      });
    }

    if (!payment && sessionId) {
      payment = await prisma.payment.findUnique({
        where: { providerPaymentId: sessionId },
        include: { debate: { include: { category: true } } },
      });
    }

    if (payment && payment.status === 'succeeded') {
      return NextResponse.json({
        verified: true,
        status: 'succeeded',
        debateId: payment.debateId,
        contributionId: payment.contributionId,
        amount: payment.amount,
      });
    }

    // 2. Check if contribution itself is verified
    if (contributionId) {
      const contribution = await prisma.contribution.findUnique({
        where: { id: contributionId },
        include: { debate: true },
      });

      if (contribution && contribution.status === 'verified') {
        return NextResponse.json({
          verified: true,
          status: 'verified',
          debateId: contribution.debateId,
          contributionId: contribution.id,
          amount: contribution.amount,
        });
      }
    }

    // 3. Check if debate itself is active
    if (debateId) {
      const debate = await prisma.debate.findUnique({
        where: { id: debateId },
      });

      if (debate && debate.status === 'active' && debate.contributionCount > 0) {
        return NextResponse.json({
          verified: true,
          status: 'verified',
          debateId: debate.id,
          amount: debate.totalVerifiedContribution,
        });
      }
    }

    return NextResponse.json({
      verified: false,
      status: 'processing',
    });
  } catch (error) {
    console.error('Payment status check error:', error);
    return NextResponse.json({ error: 'Failed to check payment status' }, { status: 500 });
  }
}
