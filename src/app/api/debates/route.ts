import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDebates } from '@/lib/debates';
import { razorpayProvider } from '@/lib/payments/razorpay-provider';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { MINIMUM_DEBATE_PAISE, formatINR } from '@/lib/money';
import { getCurrentUser } from '@/lib/user-auth';
import { isAuthorizedAdmin } from '@/lib/auth';
import { isFounder, getOrCreateFounderUser } from '@/lib/founder';
import { calculateRankingScore } from '@/lib/ranking';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const createDebateSchema = z.object({
  title: z.string().min(5, 'Debate title/opinion must be at least 5 characters').max(200, 'Title cannot exceed 200 characters'),
  content: z.string().min(5, 'Main argument must be at least 5 characters').max(3000, 'Argument cannot exceed 3000 characters'),
  categorySlug: z.string().optional(),
  categoryId: z.string().optional(),
  authorUsername: z.string().max(30).optional(),
  authorDisplayName: z.string().max(50).optional(),
  isFree: z.boolean().optional(),
  amountPaise: z.number().int().optional().nullable(),
  amountRupees: z.number().optional().nullable(),
  isAnonymous: z.boolean().optional(),
  hashtags: z.string().max(200).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'all';
    const sort = (searchParams.get('sort') || 'for_you') as any;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || searchParams.get('q') || '';

    const result = await getDebates({
      category,
      sort,
      page,
      limit,
      search,
      currentUserId: session?.userId || null,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Debates list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`create-debate:${ip}`, 30, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    // 2. Validate input schema
    const body = await request.json();
    const parsed = createDebateSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid debate input';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = parsed.data;

    // 3. Resolve user session & authoritative Founder / Admin status
    const session = await getCurrentUser();
    const isAdmin = isAuthorizedAdmin(request);
    const userIsFounder = (session && isFounder(session)) || isAdmin;

    // 4. Resolve category
    let category = null;
    if (data.categoryId) {
      category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    } else if (data.categorySlug) {
      category = await prisma.category.findFirst({
        where: { slug: data.categorySlug.toLowerCase().trim() },
      });
    }

    if (!category) {
      category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' } });
    }

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 400 });
    }

    const isAnonymous = Boolean(data.isAnonymous);

    // Extract hashtags from content / title if not passed
    let hashtags = data.hashtags;
    if (!hashtags) {
      const tags = (data.content.match(/#[a-zA-Z0-9_]+/g) || []).map((t) => t.trim());
      if (tags.length > 0) {
        hashtags = tags.slice(0, 5).join(' ');
      }
    }

    // Determine Author Identity
    let authorId = session?.userId || null;
    let authorUsername = session?.username;
    let authorDisplayName = session?.displayName;

    if (!authorUsername) {
      const rawUsername = (data.authorUsername || 'debater').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20);
      authorUsername = rawUsername || `user_${Math.random().toString(36).substring(2, 7)}`;
      authorDisplayName = (data.authorDisplayName || authorUsername).trim().substring(0, 40);
    }

    // Determine Publishing Mode: Free vs Optional Financial Backing
    let isFreePost = data.isFree === true || (data.amountPaise === 0 || data.amountRupees === 0) || (!data.amountPaise && !data.amountRupees);
    let backingPaise = 0;

    if (!isFreePost && (data.amountPaise || data.amountRupees)) {
      if (data.amountPaise !== undefined && data.amountPaise !== null) {
        backingPaise = Math.floor(data.amountPaise);
      } else if (data.amountRupees !== undefined && data.amountRupees !== null) {
        backingPaise = Math.round(data.amountRupees * 100);
      }

      if (backingPaise < MINIMUM_DEBATE_PAISE) {
        return NextResponse.json(
          { error: `Backing an opinion requires a minimum contribution of ${formatINR(MINIMUM_DEBATE_PAISE)}.` },
          { status: 400 }
        );
      }
    } else {
      isFreePost = true;
      backingPaise = 0;
    }

    // 5. FOUNDER / ADMIN POSTING (Always Published Immediately)
    if (userIsFounder) {
      const founderUser = session
        ? (await prisma.user.findUnique({ where: { id: session.userId } })) || (await getOrCreateFounderUser())
        : await getOrCreateFounderUser();

      const finalUsername = isAnonymous ? 'anonymous' : founderUser.username || 'vishalchaudhary';
      const finalDisplayName = isAnonymous ? 'Anonymous' : founderUser.displayName || 'Vishal Chaudhary';

      const initialRanking = calculateRankingScore({
        totalVerifiedPaise: backingPaise,
        likeCount: 0,
        impressionCount: 0,
        contributionCount: 1,
        uniqueParticipants: 1,
        contentLength: data.content.trim().length,
        hasHashtags: Boolean(hashtags),
        reportCount: 0,
        createdAt: new Date(),
      });

      const debate = await prisma.debate.create({
        data: {
          authorId: founderUser.id,
          title: data.title.trim(),
          content: data.content.trim(),
          categoryId: category.id,
          authorUsername: finalUsername,
          authorDisplayName: finalDisplayName,
          isAnonymous,
          hashtags: hashtags || null,
          originalContribution: backingPaise,
          totalVerifiedContribution: backingPaise,
          contributionCount: 1,
          lastContributionAmount: backingPaise,
          status: 'active',
          trendingScore: initialRanking.finalScore,
        },
        include: { category: true },
      });

      // Sequence 1 contribution record
      await prisma.contribution.create({
        data: {
          debateId: debate.id,
          authorId: founderUser.id,
          amount: backingPaise,
          content: data.content.trim(),
          sequence: 1,
          authorUsername: finalUsername,
          authorDisplayName: finalDisplayName,
          isAnonymous,
          status: 'verified',
        },
      });

      return NextResponse.json({
        success: true,
        debateId: debate.id,
        debateTitle: debate.title,
        categoryName: category.name,
        authorUsername: finalUsername,
        published: true,
        isFounderFree: true,
        isFree: isFreePost,
      });
    }

    // 6. FREE OPINION PUBLISHING (Cost: ₹0, No Payment Gate, Instant Publication)
    if (isFreePost) {
      const initialRanking = calculateRankingScore({
        totalVerifiedPaise: 0,
        likeCount: 0,
        impressionCount: 0,
        contributionCount: 1,
        uniqueParticipants: 1,
        contentLength: data.content.trim().length,
        hasHashtags: Boolean(hashtags),
        reportCount: 0,
        createdAt: new Date(),
      });

      const debate = await prisma.debate.create({
        data: {
          authorId,
          title: data.title.trim(),
          content: data.content.trim(),
          categoryId: category.id,
          authorUsername: isAnonymous ? 'anonymous' : authorUsername,
          authorDisplayName: isAnonymous ? 'Anonymous' : (authorDisplayName || authorUsername),
          isAnonymous,
          hashtags: hashtags || null,
          originalContribution: 0,
          totalVerifiedContribution: 0,
          contributionCount: 1,
          lastContributionAmount: 0,
          status: 'active',
          trendingScore: initialRanking.finalScore,
        },
        include: { category: true },
      });

      // Create verified sequence 1 author post contribution
      await prisma.contribution.create({
        data: {
          debateId: debate.id,
          authorId,
          amount: 0,
          content: data.content.trim(),
          sequence: 1,
          authorUsername: isAnonymous ? 'anonymous' : authorUsername,
          authorDisplayName: isAnonymous ? 'Anonymous' : (authorDisplayName || authorUsername),
          isAnonymous,
          status: 'verified',
        },
      });

      return NextResponse.json({
        success: true,
        published: true,
        isFree: true,
        debateId: debate.id,
        debateTitle: debate.title,
        categoryName: category.name,
        authorUsername: isAnonymous ? 'anonymous' : authorUsername,
        authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName,
        isAnonymous,
      });
    }

    // 7. OPTIONAL FINANCIALLY BACKED POST (Creates Pending Debate & Initiates Payment)
    const debate = await prisma.debate.create({
      data: {
        authorId,
        title: data.title.trim(),
        content: data.content.trim(),
        categoryId: category.id,
        authorUsername: isAnonymous ? 'anonymous' : authorUsername,
        authorDisplayName: isAnonymous ? 'Anonymous' : (authorDisplayName || authorUsername),
        isAnonymous,
        hashtags: hashtags || null,
        originalContribution: backingPaise,
        totalVerifiedContribution: 0,
        contributionCount: 0,
        lastContributionAmount: 0,
        status: 'pending_payment',
      },
      include: { category: true },
    });

    // Create pending sequence 1 Contribution
    const contribution = await prisma.contribution.create({
      data: {
        debateId: debate.id,
        authorId,
        amount: backingPaise,
        content: data.content.trim(),
        sequence: 1,
        authorUsername: isAnonymous ? 'anonymous' : authorUsername,
        authorDisplayName: isAnonymous ? 'Anonymous' : (authorDisplayName || authorUsername),
        isAnonymous,
        status: 'pending_payment',
      },
    });

    // Create Razorpay Checkout Order Session
    const checkoutSession = await razorpayProvider.createCheckoutSession({
      debateId: debate.id,
      contributionId: contribution.id,
      title: debate.title,
      amountPaise: backingPaise,
      authorUsername: isAnonymous ? 'anonymous' : authorUsername,
      customerEmail: data.email || session?.email || undefined,
    });

    return NextResponse.json({
      success: true,
      published: false,
      isFree: false,
      provider: 'razorpay',
      orderId: checkoutSession.orderId || checkoutSession.sessionId,
      sessionId: checkoutSession.sessionId,
      keyId: checkoutSession.keyId,
      amount: backingPaise,
      amountRupees: backingPaise / 100,
      currency: 'INR',
      debateId: debate.id,
      contributionId: contribution.id,
      debateTitle: debate.title,
      categoryName: category.name,
      authorUsername: isAnonymous ? 'anonymous' : authorUsername,
      authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName,
      isAnonymous,
    });
  } catch (error) {
    console.error('Create debate API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error creating debate' },
      { status: 500 }
    );
  }
}
