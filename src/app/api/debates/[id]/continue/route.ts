import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { razorpayProvider } from '@/lib/payments/razorpay-provider';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  calculateNextMinimumPaise,
  formatINR,
  MINIMUM_INCREMENT_PAISE,
  exchangeRateService,
  getCurrencyConfig,
  formatCurrencyAmount,
} from '@/lib/money';
import { getCurrentUser } from '@/lib/user-auth';
import { getOrAssignGhostDisplayName } from '@/lib/ghost/ghost-identity';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const continueDebateSchema = z.object({
  content: z.string().min(5, 'Your response must be at least 5 characters').max(3000, 'Response cannot exceed 3000 characters'),
  amountPaise: z.number().int().optional(),
  amountRupees: z.number().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  currencyCode: z.string().optional(),
  countryCode: z.string().optional(),
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
    // Rule: nextContribution >= latestVerifiedContribution + ₹1 (100 paise), min ₹10 (1000 paise)
    const latestVerifiedPaise = debate.lastContributionAmount;
    const minRequiredPaise = calculateNextMinimumPaise(latestVerifiedPaise);

    // 5. Resolve user from session if authenticated
    const session = await getCurrentUser();
    let authorId = session?.userId || null;
    let authorUsername = session?.username;
    let authorDisplayName = session?.displayName;
    let isGhost = false;
    let isAnonymous = Boolean(data.isAnonymous);

    let userCurrency: string | undefined;
    if (session?.userId) {
      const u = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { currencyCode: true },
      });
      userCurrency = u?.currencyCode || undefined;
    }

    const selectedCurrency = (
      data.currency ||
      data.currencyCode ||
      userCurrency ||
      'INR'
    ).toUpperCase().trim();

    const currencyConfig = getCurrencyConfig(selectedCurrency);
    const minRequiredMinor = exchangeRateService.convertFromBase(minRequiredPaise, selectedCurrency);
    const minRequiredFormatted = formatCurrencyAmount(minRequiredMinor, selectedCurrency);

    let contributionPaise = minRequiredPaise;
    let targetMinorUnits = minRequiredMinor;

    if (data.amount !== undefined && data.amount !== null) {
      targetMinorUnits = Math.round(data.amount * Math.pow(10, currencyConfig.decimals));
      if (targetMinorUnits < minRequiredMinor) {
        return NextResponse.json(
          {
            error: `Your contribution must be at least ${minRequiredFormatted} (${selectedCurrency}).`,
            minimumRequiredPaise: minRequiredPaise,
            latestContributionPaise: latestVerifiedPaise,
          },
          { status: 400 }
        );
      }
      contributionPaise = exchangeRateService.convertToBase(targetMinorUnits, selectedCurrency);
    } else if (data.amountRupees !== undefined && data.amountRupees !== null) {
      if (selectedCurrency === 'INR') {
        contributionPaise = Math.round(data.amountRupees * 100);
        targetMinorUnits = contributionPaise;
      } else {
        targetMinorUnits = Math.round(data.amountRupees * Math.pow(10, currencyConfig.decimals));
        if (targetMinorUnits < minRequiredMinor) {
          return NextResponse.json(
            {
              error: `Your contribution must be at least ${minRequiredFormatted} (${selectedCurrency}).`,
              minimumRequiredPaise: minRequiredPaise,
              latestContributionPaise: latestVerifiedPaise,
            },
            { status: 400 }
          );
        }
        contributionPaise = exchangeRateService.convertToBase(targetMinorUnits, selectedCurrency);
      }
    } else if (data.amountPaise !== undefined && data.amountPaise !== null) {
      if (selectedCurrency === 'INR') {
        contributionPaise = Math.floor(data.amountPaise);
        targetMinorUnits = contributionPaise;
      } else {
        targetMinorUnits = Math.floor(data.amountPaise);
        if (targetMinorUnits < minRequiredMinor) {
          return NextResponse.json(
            {
              error: `Your contribution must be at least ${minRequiredFormatted} (${selectedCurrency}).`,
              minimumRequiredPaise: minRequiredPaise,
              latestContributionPaise: latestVerifiedPaise,
            },
            { status: 400 }
          );
        }
        contributionPaise = exchangeRateService.convertToBase(targetMinorUnits, selectedCurrency);
      }
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

    if (session?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          ghostMode: true,
          ghostDisplayName: true,
        },
      });

      if (user?.ghostMode) {
        isGhost = true;
        isAnonymous = true;
        authorDisplayName = user.ghostDisplayName || (await getOrAssignGhostDisplayName(user));
        authorUsername = 'anonymous';
      } else if (!isAnonymous) {
        authorUsername = user?.username || authorUsername;
        authorDisplayName = user?.displayName || authorDisplayName;
      }
    }

    if (!authorUsername) {
      const rawUsername = (data.authorUsername || 'debater').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20);
      authorUsername = rawUsername || `user_${Math.random().toString(36).substring(2, 7)}`;
      authorDisplayName = (data.authorDisplayName || authorUsername).trim().substring(0, 40);
    }

    const effectiveDisplayName = isAnonymous ? (isGhost ? authorDisplayName : 'Anonymous') : (authorDisplayName || authorUsername);

    // 6. Create pending Contribution
    const pendingContribution = await prisma.contribution.create({
      data: {
        debateId: debate.id,
        authorId,
        amount: contributionPaise,
        content: data.content.trim(),
        sequence: debate.contributionCount + 1,
        authorUsername: isAnonymous ? 'anonymous' : authorUsername,
        authorDisplayName: effectiveDisplayName,
        isAnonymous,
        isGhost,
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
      selectedCurrency,
      selectedAmount: targetMinorUnits / Math.pow(10, currencyConfig.decimals),
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
