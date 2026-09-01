import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const debateId = searchParams.get('debate_id') || '';
    const paymentId = searchParams.get('payment_id') || '';
    const contributionId = searchParams.get('contribution_id') || '';

    if (debateId) {
      const debate = await prisma.debate.findUnique({
        where: { id: debateId },
        include: { category: true },
      });

      if (debate && debate.status === 'active') {
        return NextResponse.json({
          verified: true,
          status: 'active',
          debate: {
            id: debate.id,
            title: debate.title,
            authorUsername: debate.authorUsername,
            totalVerifiedContribution: debate.totalVerifiedContribution,
            contributionCount: debate.contributionCount,
          },
        });
      }
    }

    if (paymentId) {
      const payment = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentId },
        include: { debate: true },
      });

      if (payment && payment.status === 'succeeded') {
        return NextResponse.json({
          verified: true,
          status: 'succeeded',
          amount: payment.amount,
          currency: payment.currency,
          debateId: payment.debateId,
        });
      }
    }

    return NextResponse.json({
      verified: false,
      status: 'pending',
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
