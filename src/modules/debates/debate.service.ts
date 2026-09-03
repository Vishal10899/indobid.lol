/**
 * INDOBID — DEBATE SERVICE
 * Authoritative post creation, retrieval, updates, feed ranking, and lifecycle management.
 */

import { prisma } from '../../infrastructure/database/prisma';
import { safeDb } from '../../infrastructure/database/transactions';
import { debateRepository } from '../../infrastructure/database/repositories/debate.repository';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { categoryRepository } from '../../infrastructure/database/repositories/category.repository';
import { calculateNextMinimumPaise, MINIMUM_DEBATE_PAISE, formatINR } from '../../lib/money';
import { calculateTrendingScore } from '../feed/trending/trending.service';
import { calculateRankingScore } from '../feed/ranking/ranking.service';
import { isFounder, getOrCreateFounderUser } from '../auth/authorization';
import { UserSession } from '../auth/session.service';
import { AuthorizationError, NotFoundError, ValidationError } from '../../lib/errors';
import { CreateDebateDTO, DebateListItem, GetDebatesOptions, UpdateDebateDTO } from './debate.types';

export class DebateService {
  /**
   * Fetch public debates with pagination, search, category filter, and sorting.
   * Strictly excludes hidden, pending_payment, or removed debates.
   */
  async getDebates(options: GetDebatesOptions = {}) {
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
    if (
      category &&
      category.toLowerCase() !== 'all' &&
      category.toLowerCase() !== 'for_you' &&
      category.toLowerCase() !== 'following'
    ) {
      where.category = {
        slug: category.toLowerCase().trim(),
      };
    }

    // Following feed filter
    if (sort === 'following' && currentUserId) {
      const following = await safeDb(() =>
        prisma.follow.findMany({
          where: { followerId: currentUserId },
          select: { followingId: true },
        })
      );
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

    // Sort order
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

    const [total, debates] = await safeDb(() =>
      Promise.all([
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
      ])
    );

    let items: DebateListItem[] = debates.map((d) => ({
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

    // Multi-Signal Personalization and Feed Diversity for 'for_you' feed
    if (sort === 'for_you' && items.length > 1) {
      let followedIds = new Set<string>();
      let engagedCategoryIds = new Set<string>();

      if (currentUserId) {
        const [follows, likes, bookmarks] = await safeDb(() =>
          Promise.all([
            prisma.follow.findMany({
              where: { followerId: currentUserId },
              select: { followingId: true },
            }),
            prisma.debateLike.findMany({
              where: { userId: currentUserId },
              select: { debate: { select: { categoryId: true } } },
              take: 30,
            }),
            prisma.debateBookmark.findMany({
              where: { userId: currentUserId },
              select: { debate: { select: { categoryId: true } } },
              take: 30,
            }),
          ])
        );
        followedIds = new Set(follows.map((f) => f.followingId));
        likes.forEach((l) => l.debate?.categoryId && engagedCategoryIds.add(l.debate.categoryId));
        bookmarks.forEach((b) => b.debate?.categoryId && engagedCategoryIds.add(b.debate.categoryId));
      }

      const scoredItems = items.map((item) => {
        const isAffinity = item.category?.id ? engagedCategoryIds.has(item.category.id) : false;
        const score = calculateRankingScore({
          totalVerifiedPaise: item.totalVerifiedContribution,
          likeCount: item.likeCount,
          impressionCount: item.impressionCount,
          contributionCount: item.contributionCount,
          contentLength: item.content.length,
          hasHashtags: Boolean(item.hashtags),
          reportCount: 0,
          createdAt: item.createdAt,
          isFollowedAuthor: item.authorId ? followedIds.has(item.authorId) : false,
          isCategoryAffinity: isAffinity,
        }).finalScore;
        return { item, score };
      });

      scoredItems.sort((a, b) => b.score - a.score);

      // Apply author diversity: prevent one author from occupying more than 2 consecutive slots
      const diversified: DebateListItem[] = [];
      const pool = [...scoredItems];
      let lastAuthor: string | null = null;
      let consecutiveAuthorCount = 0;

      while (pool.length > 0) {
        let pickIndex = 0;
        if (lastAuthor && consecutiveAuthorCount >= 2) {
          const altIndex = pool.findIndex((p) => p.item.authorUsername !== lastAuthor);
          if (altIndex !== -1) {
            pickIndex = altIndex;
          }
        }

        const picked = pool.splice(pickIndex, 1)[0];
        if (picked.item.authorUsername === lastAuthor) {
          consecutiveAuthorCount++;
        } else {
          lastAuthor = picked.item.authorUsername;
          consecutiveAuthorCount = 1;
        }
        diversified.push(picked.item);
      }

      items = diversified;
    }

    return {
      debates: items,
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
  async getDebateById(id: string) {
    if (!id) return null;

    const debate = await safeDb(() =>
      prisma.debate.findUnique({
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
      })
    );

    if (!debate || debate.status !== 'active') {
      return null;
    }

    const minimumNextContribution = calculateNextMinimumPaise(debate.lastContributionAmount);

    const sanitizedContributions = debate.contributions.map((c) => ({
      ...c,
      authorUsername: c.isAnonymous ? 'anonymous' : c.authorUsername,
      authorDisplayName: c.isAnonymous ? 'Anonymous' : c.authorDisplayName,
      authorAvatarUrl: c.isAnonymous ? null : c.author?.avatarUrl || null,
      authorIsVerified: c.isAnonymous ? false : c.author?.isVerified || false,
      authorId: c.isAnonymous ? null : c.authorId,
    }));

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
  async updateDebateTrendingScore(debateId: string) {
    const debate = await safeDb(() =>
      prisma.debate.findUnique({
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
      })
    );

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

    await safeDb(() =>
      prisma.debate.update({
        where: { id: debateId },
        data: { trendingScore: score },
      })
    );
  }

  async update(id: string, userId: string, dto: UpdateDebateDTO) {
    const debate = await debateRepository.findById(id);
    if (!debate) throw new NotFoundError('Debate not found');

    if (debate.authorId !== userId) {
      throw new AuthorizationError('You are not authorized to edit this post');
    }

    if (dto.content !== undefined && dto.content.trim().length < 5) {
      throw new ValidationError('Post content must be at least 5 characters');
    }

    const data: any = {};
    if (dto.title) data.title = dto.title.trim();
    if (dto.content) data.content = dto.content.trim();
    if (dto.hashtags !== undefined) data.hashtags = dto.hashtags;

    const updated = await debateRepository.update(id, data);

    // Also update sequence 1 contribution text if content changed
    if (dto.content) {
      await safeDb(() =>
        prisma.contribution.updateMany({
          where: { debateId: id, sequence: 1 },
          data: { content: dto.content!.trim() },
        })
      );
    }

    return updated;
  }

  async createDebate(
    data: CreateDebateDTO,
    session: UserSession | null,
    isAdmin = false
  ) {
    // 1. Resolve category
    let category: any = null;
    if (data.categoryId) {
      category = await safeDb(() => prisma.category.findUnique({ where: { id: data.categoryId } }));
    } else if (data.categorySlug) {
      category = await safeDb(() =>
        prisma.category.findFirst({
          where: { slug: data.categorySlug!.toLowerCase().trim() },
        })
      );
    }

    if (!category) {
      category = await safeDb(() => prisma.category.findFirst({ orderBy: { sortOrder: 'asc' } }));
    }

    if (!category) {
      throw new ValidationError('Category not found');
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
      const rawUsername = (data.authorUsername || 'debater')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase()
        .substring(0, 20);
      authorUsername = rawUsername || `user_${Math.random().toString(36).substring(2, 7)}`;
      authorDisplayName = (data.authorDisplayName || authorUsername).trim().substring(0, 40);
    }

    // Determine Publishing Mode: Free vs Optional Financial Backing
    let isFreePost =
      data.isFree === true ||
      data.amountPaise === 0 ||
      data.amountRupees === 0 ||
      (!data.amountPaise && !data.amountRupees);
    let backingPaise = 0;

    if (!isFreePost && (data.amountPaise || data.amountRupees)) {
      if (data.amountPaise !== undefined && data.amountPaise !== null) {
        backingPaise = Math.floor(data.amountPaise);
      } else if (data.amountRupees !== undefined && data.amountRupees !== null) {
        backingPaise = Math.round(data.amountRupees * 100);
      }

      if (backingPaise < MINIMUM_DEBATE_PAISE) {
        throw new ValidationError(
          `Backing an opinion requires a minimum contribution of ${formatINR(MINIMUM_DEBATE_PAISE)}.`
        );
      }
    } else {
      isFreePost = true;
      backingPaise = 0;
    }

    const userIsFounder = (session && isFounder(session)) || isAdmin;

    // 2. FOUNDER / ADMIN POSTING (Always Published Immediately)
    if (userIsFounder) {
      const founderUser = session
        ? (await safeDb(() => prisma.user.findUnique({ where: { id: session.userId } }))) ||
          (await getOrCreateFounderUser())
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

      const debate = await safeDb(() =>
        prisma.debate.create({
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
        })
      );

      // Sequence 1 contribution record
      await safeDb(() =>
        prisma.contribution.create({
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
        })
      );

      return {
        success: true,
        debateId: debate.id,
        debateTitle: debate.title,
        categoryName: category.name,
        authorUsername: finalUsername,
        published: true,
        isFounderFree: true,
        isFree: isFreePost,
      };
    }

    // 3. FREE OPINION PUBLISHING (Cost: ₹0, No Payment Gate, Instant Publication)
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

      const debate = await safeDb(() =>
        prisma.debate.create({
          data: {
            authorId,
            title: data.title.trim(),
            content: data.content.trim(),
            categoryId: category.id,
            authorUsername: isAnonymous ? 'anonymous' : authorUsername,
            authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName || authorUsername,
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
        })
      );

      // Create verified sequence 1 author post contribution
      await safeDb(() =>
        prisma.contribution.create({
          data: {
            debateId: debate.id,
            authorId,
            amount: 0,
            content: data.content.trim(),
            sequence: 1,
            authorUsername: isAnonymous ? 'anonymous' : authorUsername,
            authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName || authorUsername,
            isAnonymous,
            status: 'verified',
          },
        })
      );

      return {
        success: true,
        published: true,
        isFree: true,
        debateId: debate.id,
        debateTitle: debate.title,
        categoryName: category.name,
        authorUsername: isAnonymous ? 'anonymous' : authorUsername,
        authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName,
        isAnonymous,
      };
    }

    // 4. OPTIONAL FINANCIALLY BACKED POST (Creates Pending Debate & Initiates Payment)
    const debate = await safeDb(() =>
      prisma.debate.create({
        data: {
          authorId,
          title: data.title.trim(),
          content: data.content.trim(),
          categoryId: category.id,
          authorUsername: isAnonymous ? 'anonymous' : authorUsername,
          authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName || authorUsername,
          isAnonymous,
          hashtags: hashtags || null,
          originalContribution: backingPaise,
          totalVerifiedContribution: 0,
          contributionCount: 0,
          lastContributionAmount: 0,
          status: 'pending_payment',
        },
        include: { category: true },
      })
    );

    // Create pending sequence 1 Contribution
    const contribution = await safeDb(() =>
      prisma.contribution.create({
        data: {
          debateId: debate.id,
          authorId,
          amount: backingPaise,
          content: data.content.trim(),
          sequence: 1,
          authorUsername: isAnonymous ? 'anonymous' : authorUsername,
          authorDisplayName: isAnonymous ? 'Anonymous' : authorDisplayName || authorUsername,
          isAnonymous,
          status: 'pending_payment',
        },
      })
    );

    const { paymentService } = await import('../payments/payment.service');
    const checkoutSession = await paymentService.createCheckoutSession({
      debateId: debate.id,
      contributionId: contribution.id,
      title: debate.title,
      amountPaise: backingPaise,
      authorUsername: isAnonymous ? 'anonymous' : authorUsername,
      customerEmail: data.email || session?.email || undefined,
    });

    return {
      success: true,
      published: false,
      isFree: false,
      provider: 'razorpay' as const,
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
    };
  }

  async hide(id: string, userId: string, isAdmin = false) {
    const debate = await debateRepository.findById(id);
    if (!debate) throw new NotFoundError('Debate not found');

    if (debate.authorId !== userId && !isAdmin) {
      throw new AuthorizationError('You are not authorized to hide this post');
    }

    return debateRepository.update(id, { status: 'hidden' });
  }
}

export const debateService = new DebateService();
export const getDebates = (options?: GetDebatesOptions) => debateService.getDebates(options);
export const getDebateById = (id: string) => debateService.getDebateById(id);
export const updateDebateTrendingScore = (debateId: string) =>
  debateService.updateDebateTrendingScore(debateId);
