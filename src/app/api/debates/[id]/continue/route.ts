import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { razorpayProvider } from '@/lib/payments/razorpay-provider';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { calculateNextMinimumPaise, formatINR, MINIMUM_INCREMENT_PAISE } from '@/lib/money';
import { getCurrentUser } from '@/lib/user-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const continueDebateSchema = z.object({
  content: z.string().min(5, 'Your response must be at least 5 characters').max(3000, 'Response cannot exceed 3000 characters'),
  amountPaise: z.number().int().optional(),
  amountRupees: z.number().optional(),
  authorUsername: z.string().max(30).optional(),
  authorDisplayName: z.string().max(50).optional(),
  isAnonymous: z.boolean().optional(),
  email: z.string().email('Invalid email address').optional().nullable(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: debateId } = await context.params;
    if (!debateId) {
      return NextResponse.json({ error: 'Debate ID is required' }, { status: 400 });
    }

    // 1. Rate limiting
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`continue-debate:${ip}`, 30, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    // 2. Validate input schema
    const body = await request.json();
    const parsed = continueDebateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid contribution input';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = parsed.data;

    // 3. Fetch current Debate from DB
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
    });

    if (!debate) {
      return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
    }

    if (debate.status !== 'active') {
      return NextResponse.json(
        { error: 'This debate is currently not active for contributions' },
        { status: 400 }
      );
    }

    // 4. Authoritative Minimum Contribution Calculation
    // Rule: nextContribution >= latestVerifiedContribution + ₹1 (100 paise)
    const latestVerifiedPaise = debate.lastContributionAmount;
    const minRequiredPaise = calculateNextMinimumPaise(latestVerifiedPaise);

    let contributionPaise = minRequiredPaise;
    if (data.amountPaise !== undefined && data.amountPaise !== null) {
      contributionPaise = Math.floor(data.amountPaise);
    } else if (data.amountRupees !== undefined && data.amountRupees !== null) {
      contributionPaise = Math.round(data.amountRupees * 100);
    }

    if (contributionPaise < minRequiredPaise) {
      return NextResponse.json(
        {
          error: `Your contribution must be at least ${formatINR(minRequiredPaise)} (previous contribution was ${formatINR(latestVerifiedPaise)}).`,
          minimumRequiredPaise: minRequiredPaise,
          latestContributionPaise: latestVerifiedPaise,
        },
        { status: 400 }
      );
    }

    // 5. Resolve user from session if authenticated
    const session = await getCurrentUser();
    let authorId = session?.userId || null;
    let authorUsername = session?.username;
    let authorDisplayName = session?.displayName;

    if (!authorUsername) {
      const rawUsername = (data.authorUsername || 'debater').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20);
      authorUsername = rawUsername || `user_${Math.random().toString(36).substring(2, 7)}`;
      authorDisplayName = (data.authorDisplayName || authorUsername).trim().substring(0, 40);
    }

    const isAnonymous = Boolean(data.isAnonymous);

    // 6. Create pending Contribution
    const pendingContribution = await prisma.contribution.create({
      data: {
        debateId: debate.id,
        authorId,
        amount: contributionPaise,
        content: data.content.trim(),
        sequence: debate.contributionCount + 1,
        authorUsername,
        authorDisplayName: authorDisplayName || authorUsername,
        isAnonymous,
        status: 'pending_payment',
      },
    });

    // 7. Create Razorpay Checkout Order Session
    const checkoutSession = await razorpayProvider.createCheckoutSession({
      debateId: debate.id,
      contributionId: pendingContribution.id,
      title: debate.title,
      amountPaise: contributionPaise,
      authorUsername: isAnonymous ? 'anonymous' : authorUsername,
      customerEmail: data.email || session?.email || undefined,
    });

    return NextResponse.json({
      success: true,
      provider: 'razorpay',
      orderId: checkoutSession.orderId || checkoutSession.sessionId,
      sessionId: checkoutSession.sessionId,
      keyId: checkoutSession.keyId,
      amount: contributionPaise,
      amountRupees: contributionPaise / 100,
      currency: 'INR',
      debateId: debate.id,
      contributionId: pendingContribution.id,
      debateTitle: debate.title,
      authorUsername: isAnonymous ? 'anonymous' : authorUsername,
      authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName,
      isAnonymous,
      minimumRequiredPaise: minRequiredPaise,
      previousContributionPaise: latestVerifiedPaise,
    });
  } catch (error) {
    console.error('Continue debate API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error continuing debate' },
      { status: 500 }
    );
  }
}
