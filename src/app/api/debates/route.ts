import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDebates } from '@/lib/debates';
import { razorpayProvider } from '@/lib/payments/razorpay-provider';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { MINIMUM_DEBATE_PAISE, formatINR } from '@/lib/money';
import { getCurrentUser } from '@/lib/user-auth';
import { isAuthorizedAdmin } from '@/lib/auth';
import { isFounder, getOrCreateFounderUser } from '@/lib/founder';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createDebateSchema = z.object({
  title: z.string().min(5, 'Debate title/opinion must be at least 5 characters').max(200, 'Title cannot exceed 200 characters'),
  content: z.string().min(10, 'Main argument must be at least 10 characters').max(3000, 'Argument cannot exceed 3000 characters'),
  categorySlug: z.string().optional(),
  categoryId: z.string().optional(),
  authorUsername: z.string().max(30).optional(),
  authorDisplayName: z.string().max(50).optional(),
  amountPaise: z.number().int().optional(),
  amountRupees: z.number().optional(),
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
    const rateLimit = checkRateLimit(`create-debate:${ip}`, 20, 60);
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

    // 5. FOUNDER / ADMIN FREE POSTING (Zero Razorpay, Instant Publish)
    if (userIsFounder) {
      const founderUser = session
        ? (await prisma.user.findUnique({ where: { id: session.userId } })) || (await getOrCreateFounderUser())
        : await getOrCreateFounderUser();

      const authorUsername = isAnonymous ? 'anonymous' : founderUser.username || 'vishalchaudhary';
      const authorDisplayName = isAnonymous ? 'Anonymous' : founderUser.displayName || 'Vishal Chaudhary';

      const debate = await prisma.debate.create({
        data: {
          authorId: founderUser.id,
          title: data.title.trim(),
          content: data.content.trim(),
          categoryId: category.id,
          authorUsername,
          authorDisplayName,
          isAnonymous,
          hashtags: hashtags || null,
          originalContribution: 0,
          totalVerifiedContribution: 0,
          contributionCount: 0,
          lastContributionAmount: 0,
          status: 'active',
          trendingScore: 10.0,
        },
        include: { category: true },
      });

      return NextResponse.json({
        success: true,
        debateId: debate.id,
        debateTitle: debate.title,
        categoryName: category.name,
        authorUsername,
        published: true,
        isFounderFree: true,
      });
    }

    // 6. NORMAL USERS: Strictly enforce ₹10 minimum contribution and Razorpay payment flow
    let contributionPaise = MINIMUM_DEBATE_PAISE;
    if (data.amountPaise !== undefined && data.amountPaise !== null) {
      contributionPaise = Math.floor(data.amountPaise);
    } else if (data.amountRupees !== undefined && data.amountRupees !== null) {
      contributionPaise = Math.round(data.amountRupees * 100);
    }

    if (contributionPaise < MINIMUM_DEBATE_PAISE) {
      return NextResponse.json(
        { error: `Starting a new debate requires a minimum contribution of ${formatINR(MINIMUM_DEBATE_PAISE)}.` },
        { status: 400 }
      );
    }

    let authorId = session?.userId || null;
    let authorUsername = session?.username;
    let authorDisplayName = session?.displayName;

    if (!authorUsername) {
      const rawUsername = (data.authorUsername || 'debater').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20);
      authorUsername = rawUsername || `user_${Math.random().toString(36).substring(2, 7)}`;
      authorDisplayName = (data.authorDisplayName || authorUsername).trim().substring(0, 40);
    }

    // 7. Create Debate in pending_payment state (with verified total = 0)
    const debate = await prisma.debate.create({
      data: {
        authorId,
        title: data.title.trim(),
        content: data.content.trim(),
        categoryId: category.id,
        authorUsername,
        authorDisplayName: authorDisplayName || authorUsername,
        isAnonymous,
        hashtags: hashtags || null,
        originalContribution: contributionPaise,
        totalVerifiedContribution: 0,
        contributionCount: 0,
        lastContributionAmount: 0,
        status: 'pending_payment',
      },
      include: { category: true },
    });

    // 8. Create pending sequence 1 Contribution
    const contribution = await prisma.contribution.create({
      data: {
        debateId: debate.id,
        authorId,
        amount: contributionPaise,
        content: data.content.trim(),
        sequence: 1,
        authorUsername,
        authorDisplayName: authorDisplayName || authorUsername,
        isAnonymous,
        status: 'pending_payment',
      },
    });

    // 9. Create Razorpay Checkout Order Session
    const checkoutSession = await razorpayProvider.createCheckoutSession({
      debateId: debate.id,
      contributionId: contribution.id,
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
