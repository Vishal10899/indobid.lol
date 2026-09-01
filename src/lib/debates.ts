import { prisma } from './db';
import { calculateNextMinimumPaise, MINIMUM_DEBATE_PAISE } from './money';
import { calculateTrendingScore } from './trending';

export interface DebateListItem {
  id: string;
  title: string;
  content: string;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
  authorId?: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorIsVerified?: boolean;
  authorRole?: string | null;
  originalContribution: number; // in paise
  totalVerifiedContribution: number; // in paise
  contributionCount: number;
  lastContributionAmount: number; // in paise
  minimumNextContribution: number; // in paise
  trendingScore: number;
  likeCount: number;
  impressionCount: number;
  isAnonymous: boolean;
  hashtags?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetDebatesOptions {
  category?: string;
  sort?: 'for_you' | 'highest_value' | 'trending' | 'new' | 'newest' | 'top' | 'rising' | 'active' | 'following';
  page?: number;
  limit?: number;
  search?: string;
  currentUserId?: string | null;
}

async function safeDb<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw new Error('Database operation failed after retries');
}

/**
 * Fetch public debates with pagination, search, category filter, and sorting
 * Strictly excludes hidden, pending_payment, or removed debates.
 */
export async function getDebates(options: GetDebatesOptions = {}) {
  const {
    category = 'all',
    sort = 'for_you',
    page = 1,
    limit = 20,
    search = '',
    currentUserId = null,
  } = options;

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  // Base query: strictly active verified debates
  const where: any = {
    status: 'active',
  };

  // Category filter
  if (category && category.toLowerCase() !== 'all' && category.toLowerCase() !== 'for_you' && category.toLowerCase() !== 'following') {
    where.category = {
      slug: category.toLowerCase().trim(),
    };
  }

  // Following feed filter
  if (sort === 'following' && currentUserId) {
    const following = await safeDb(() => prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    }));
    const followingIds = following.map((f) => f.followingId);
    where.authorId = { in: followingIds };
  }

  // Search filter
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
      { authorUsername: { contains: q, mode: 'insensitive' } },
      { authorDisplayName: { contains: q, mode: 'insensitive' } },
      { hashtags: { contains: q, mode: 'insensitive' } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  // Sort order (PRD v1.0 Locked: Highest Value, Trending, New, For You, Following)
  let orderBy: any = [{ trendingScore: 'desc' }, { createdAt: 'desc' }];
  if (sort === 'highest_value' || sort === 'top') {
    orderBy = [{ totalVerifiedContribution: 'desc' }, { createdAt: 'desc' }];
  } else if (sort === 'trending') {
    orderBy = [{ trendingScore: 'desc' }, { lastContributionAt: 'desc' }, { createdAt: 'desc' }];
  } else if (sort === 'new' || sort === 'newest') {
    orderBy = [{ createdAt: 'desc' }];
  } else if (sort === 'rising') {
    orderBy = [{ lastContributionAt: 'desc' }, { trendingScore: 'desc' }];
  } else if (sort === 'active') {
    orderBy = [{ contributionCount: 'desc' }, { lastContributionAt: 'desc' }];
  } else if (sort === 'for_you') {
    orderBy = [{ trendingScore: 'desc' }, { totalVerifiedContribution: 'desc' }, { createdAt: 'desc' }];
  }

  const [total, debates] = await safeDb(() => Promise.all([
    prisma.debate.count({ where }),
    prisma.debate.findMany({
      where,
      orderBy,
      skip,
      take: safeLimit,
      include: {
        category: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        author: {
          select: { avatarUrl: true, isVerified: true, role: true },
        },
      },
    }),
  ]));

  const items: DebateListItem[] = debates.map((d) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    category: d.category,
    authorId: d.isAnonymous ? null : d.authorId,
    authorUsername: d.isAnonymous ? 'anonymous' : d.authorUsername,
    authorDisplayName: d.isAnonymous ? 'Anonymous' : d.authorDisplayName,
    authorAvatarUrl: d.isAnonymous ? null : d.author?.avatarUrl || null,
    authorIsVerified: d.isAnonymous ? false : d.author?.isVerified || false,
    authorRole: d.isAnonymous ? null : d.author?.role || null,
    originalContribution: d.originalContribution,
    totalVerifiedContribution: d.totalVerifiedContribution,
    contributionCount: d.contributionCount,
    lastContributionAmount: d.lastContributionAmount,
    minimumNextContribution: calculateNextMinimumPaise(d.lastContributionAmount),
    trendingScore: d.trendingScore,
    likeCount: d.likeCount,
    impressionCount: d.impressionCount,
    isAnonymous: d.isAnonymous,
    hashtags: d.hashtags,
    status: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

/**
 * Fetch a single debate by ID with its verified contribution chain
 */
export async function getDebateById(id: string) {
  if (!id) return null;

  const debate = await prisma.debate.findUnique({
    where: { id },
    include: {
      category: {
        select: { id: true, name: true, slug: true, icon: true },
      },
      author: {
        select: { avatarUrl: true, isVerified: true, role: true },
      },
      contributions: {
        where: { status: 'verified' },
        orderBy: { sequence: 'asc' },
        include: {
          author: {
            select: { avatarUrl: true, isVerified: true, role: true },
          },
        },
      },
    },
  });

  if (!debate || debate.status !== 'active') {
    return null;
  }

  const minimumNextContribution = calculateNextMinimumPaise(debate.lastContributionAmount);

  // Sanitize anonymous contributions and debate author
  const sanitizedContributions = debate.contributions.map((c) => ({
    ...c,
    authorUsername: c.isAnonymous ? 'anonymous' : c.authorUsername,
    authorDisplayName: c.isAnonymous ? 'Anonymous' : c.authorDisplayName,
    authorAvatarUrl: c.isAnonymous ? null : c.author?.avatarUrl || null,
    authorIsVerified: c.isAnonymous ? false : c.author?.isVerified || false,
    authorId: c.isAnonymous ? null : c.authorId,
  }));

    // Calculate creator reward & external backing deterministically
  const creatorClean = (debate.authorUsername || '').toLowerCase().trim();
  let creatorInitialPaise = 0;
  let creatorSelfContinuationsPaise = 0;
  let eligibleExternalBackingPaise = 0;

  for (const c of debate.contributions) {
    const isCreator = (c.authorUsername || '').toLowerCase().trim() === creatorClean;
    if (isCreator) {
      if (c.sequence === 1 && debate.originalContribution > 0) {
        creatorInitialPaise += c.amount;
      } else {
        creatorSelfContinuationsPaise += c.amount;
      }
    } else {
      eligibleExternalBackingPaise += c.amount;
    }
  }

  const creatorRewardPaise = Math.floor((eligibleExternalBackingPaise * 1000) / 10000);

  return {
    ...debate,
    authorUsername: debate.isAnonymous ? 'anonymous' : debate.authorUsername,
    authorDisplayName: debate.isAnonymous ? 'Anonymous' : debate.authorDisplayName,
    authorAvatarUrl: debate.isAnonymous ? null : debate.author?.avatarUrl || null,
    authorIsVerified: debate.isAnonymous ? false : debate.author?.isVerified || false,
    authorId: debate.isAnonymous ? null : debate.authorId,
    contributions: sanitizedContributions,
    minimumNextContribution,
    rewardBreakdown: {
      creatorInitialPaise,
      creatorSelfContinuationsPaise,
      eligibleExternalBackingPaise,
      creatorRewardPaise,
    },
  };
}

/**
 * Recompute and update the trending score for a specific debate
 */
export async function updateDebateTrendingScore(debateId: string) {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      contributions: {
        where: { status: 'verified' },
        select: {
          amount: true,
          authorUsername: true,
          createdAt: true,
        },
      },
    },
  });

  if (!debate || debate.status !== 'active') return;

  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * 24 * 60 * 60 * 1000;

  let recent24hPaise = 0;
  let recent7dPaise = 0;
  const participants = new Set<string>();
  participants.add(debate.authorUsername.toLowerCase());

  for (const c of debate.contributions) {
    const age = now - new Date(c.createdAt).getTime();
    if (age <= ms24h) {
      recent24hPaise += c.amount;
    }
    if (age <= ms7d) {
      recent7dPaise += c.amount;
    }
    if (c.authorUsername) {
      participants.add(c.authorUsername.toLowerCase());
    }
  }

  const score = calculateTrendingScore({
    totalVerifiedPaise: debate.totalVerifiedContribution,
    recent24hVerifiedPaise: recent24hPaise,
    recent7dVerifiedPaise: recent7dPaise,
    contributionCount: debate.contributionCount,
    uniqueParticipants: participants.size,
    lastContributionAt: debate.lastContributionAt,
    createdAt: debate.createdAt,
  });

  await prisma.debate.update({
    where: { id: debateId },
    data: { trendingScore: score },
  });
}
