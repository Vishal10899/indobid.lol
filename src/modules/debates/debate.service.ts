/**
 * INDOBID — DEBATE SERVICE
 * Authoritative post creation, retrieval, updates, feed ranking, and lifecycle management.
 */

import { prisma } from '../../infrastructure/database/prisma';
import { safeDb } from '../../infrastructure/database/transactions';
import { debateRepository } from '../../infrastructure/database/repositories/debate.repository';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { categoryRepository } from '../../infrastructure/database/repositories/category.repository';
import {
  calculateNextMinimumPaise,
  MINIMUM_DEBATE_PAISE,
  BASE_MINIMUM_SUPPORT_PAISE,
  getMinimumSupport,
  getCurrencyConfig,
  exchangeRateService,
  formatINR,
} from '../../lib/money';
import { calculateTrendingScore } from '../feed/trending/trending.service';
import { calculateRankingScore } from '../feed/ranking/ranking.service';
import { isFounder, getOrCreateFounderUser } from '../auth/authorization';
import { UserSession } from '../auth/session.service';
import { AuthorizationError, NotFoundError, ValidationError } from '../../lib/errors';
import { CreateDebateDTO, DebateListItem, GetDebatesOptions, UpdateDebateDTO } from './debate.types';
import { resolveAuthorIdentity } from '../users/author-identity';
import { getOrAssignGhostDisplayName } from '../../lib/ghost/ghost-identity';
import { calculateSearchRelevanceScore } from '../feed/algorithms/search';
import { personalizationService } from '../feed/signals/personalization.service';

export class DebateService {
  /**
   * Fetch public debates with pagination, search, category filter, and sorting.
   * Strictly excludes hidden, pending_payment, or removed debates.
   */
  async getDebates(options: GetDebatesOptions = {}, userIdArg?: string | null) {
    const {
      category = 'all',
      sort = 'for_you',
      page = 1,
      limit = 20,
      search = '',
    } = options;

    const currentUserId = options.currentUserId || userIdArg || null;

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
    if (sort === 'following') {
      if (currentUserId) {
        const following = await safeDb(() =>
          prisma.follow.findMany({
            where: { followerId: currentUserId },
            select: { followingId: true },
          })
        );
        const followingIds = following.map((f) => f.followingId);
        where.authorId = { in: followingIds };
      } else {
        where.authorId = { in: [] };
      }
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

    const isSearchQuery = Boolean(search && search.trim());

    // Sort order
    let orderBy: any = [{ trendingScore: 'desc' }, { createdAt: 'desc' }];
    if (sort === 'highest_value' || sort === 'top' || sort === 'top_paid') {
      orderBy = [{ totalVerifiedContribution: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'top_reach') {
      orderBy = [{ impressionCount: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'top_engagement') {
      orderBy = [{ likeCount: 'desc' }, { contributionCount: 'desc' }, { createdAt: 'desc' }];
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

    const candidateTake = isSearchQuery || sort === 'for_you'
      ? Math.min(150, Math.max(safeLimit * (safePage + 1), 50))
      : safeLimit;

    const candidateSkip = isSearchQuery || sort === 'for_you' ? 0 : skip;

    const [total, debates] = await safeDb(() =>
      Promise.all([
        prisma.debate.count({ where }),
        prisma.debate.findMany({
          where,
          orderBy,
          skip: candidateSkip,
          take: candidateTake,
          include: {
            category: {
              select: { id: true, name: true, slug: true, icon: true },
            },
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true,
                role: true,
                isPrivate: true,
                ghostMode: true,
                ghostDisplayName: true,
              },
            },
          },
        }),
      ])
    );

    let items: DebateListItem[] = debates.map((d) => {
      const resolved = resolveAuthorIdentity(
        {
          authorId: d.authorId,
          authorUsername: d.authorUsername,
          authorDisplayName: d.authorDisplayName,
          author: d.author,
          isAnonymous: d.isAnonymous,
          isGhost: d.isGhost,
        },
        { currentUserId }
      );

      return {
        id: d.id,
        title: d.title,
        content: d.content,
        category: d.category,
        authorId: resolved.authorId,
        authorUsername: resolved.authorUsername,
        authorDisplayName: resolved.authorDisplayName,
        authorAvatarUrl: resolved.authorAvatarUrl,
        authorIsVerified: resolved.authorIsVerified,
        authorRole: resolved.authorRole,
        originalContribution: d.originalContribution,
        totalVerifiedContribution: d.totalVerifiedContribution,
        contributionCount: d.contributionCount,
        lastContributionAmount: d.lastContributionAmount,
        minimumNextContribution: calculateNextMinimumPaise(d.lastContributionAmount),
        trendingScore: d.trendingScore,
        likeCount: d.likeCount,
        impressionCount: d.impressionCount,
        isAnonymous: resolved.isAnonymous,
        isGhost: resolved.isGhost,
        isClickableProfile: resolved.isClickableProfile,
        hashtags: d.hashtags,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });

    // 1. Search Relevance Scoring (Relevance dominates paid conviction)
    if (isSearchQuery && items.length > 0) {
      const queryStr = search.trim();
      const scoredForSearch = items.map((item) => ({
        item,
        relevance: calculateSearchRelevanceScore(item, queryStr),
      }));
      scoredForSearch.sort((a, b) => b.relevance - a.relevance);
      items = scoredForSearch.map((s) => s.item).slice(skip, skip + safeLimit);
    }
    // 2. Multi-Signal Personalization and Feed Diversity for 'for_you' feed
    else if (sort === 'for_you' && items.length > 1) {
      const userProfile = await personalizationService.getUserInterestProfile(currentUserId);

      const scoredItems = items.map((item) => {
        const personalAffinityScore = personalizationService.computeAffinityScore(
          {
            categoryId: item.category.id,
            categorySlug: item.category.slug,
            authorId: item.authorId,
          },
          userProfile
        );

        const paidPriorityBoost = item.totalVerifiedContribution > 0
          ? 10 + Math.min(25, Math.round(5 * Math.log10(1 + item.totalVerifiedContribution / 1000) * 10) / 10)
          : 0;

        const baseScore = calculateRankingScore({
          totalVerifiedPaise: item.totalVerifiedContribution,
          likeCount: item.likeCount,
          impressionCount: item.impressionCount,
          contributionCount: item.contributionCount,
          contentLength: item.content.length,
          hasHashtags: Boolean(item.hashtags),
          reportCount: 0,
          createdAt: item.createdAt,
          personalAffinityScore,
        }).finalScore;

        const score = baseScore + paidPriorityBoost;
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

      items = diversified.slice(skip, skip + safeLimit);
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
  async getDebateById(id: string, currentUserId?: string | null) {
    if (!id) return null;

    const debate = await safeDb(() =>
      prisma.debate.findUnique({
        where: { id },
        include: {
          category: {
            select: { id: true, name: true, slug: true, icon: true },
          },
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
              role: true,
              isPrivate: true,
              ghostMode: true,
              ghostDisplayName: true,
            },
          },
          contributions: {
            where: { status: 'verified' },
            orderBy: { sequence: 'asc' },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isVerified: true,
                  role: true,
                  isPrivate: true,
                  ghostMode: true,
                  ghostDisplayName: true,
                },
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

    const sanitizedContributions = debate.contributions.map((c) => {
      const resolved = resolveAuthorIdentity(
        {
          authorId: c.authorId,
          authorUsername: c.authorUsername,
          authorDisplayName: c.authorDisplayName,
          author: c.author,
          isAnonymous: c.isAnonymous,
          isGhost: c.isGhost,
        },
        { currentUserId }
      );

      return {
        ...c,
        authorUsername: resolved.authorUsername,
        authorDisplayName: resolved.authorDisplayName,
        authorAvatarUrl: resolved.authorAvatarUrl,
        authorIsVerified: resolved.authorIsVerified,
        authorRole: resolved.authorRole,
        authorId: resolved.authorId,
        isAnonymous: resolved.isAnonymous,
        isGhost: resolved.isGhost,
        isClickableProfile: resolved.isClickableProfile,
      };
    });

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

    const resolvedDebateAuthor = resolveAuthorIdentity(
      {
        authorId: debate.authorId,
        authorUsername: debate.authorUsername,
        authorDisplayName: debate.authorDisplayName,
        author: debate.author,
        isAnonymous: debate.isAnonymous,
        isGhost: debate.isGhost,
      },
      { currentUserId }
    );

    return {
      ...debate,
      authorUsername: resolvedDebateAuthor.authorUsername,
      authorDisplayName: resolvedDebateAuthor.authorDisplayName,
      authorAvatarUrl: resolvedDebateAuthor.authorAvatarUrl,
      authorIsVerified: resolvedDebateAuthor.authorIsVerified,
      authorRole: resolvedDebateAuthor.authorRole,
      authorId: resolvedDebateAuthor.authorId,
      isAnonymous: resolvedDebateAuthor.isAnonymous,
      isGhost: resolvedDebateAuthor.isGhost,
      isClickableProfile: resolvedDebateAuthor.isClickableProfile,
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

    let isGhost = Boolean(data.isGhost);
    let isAnonymous = Boolean(data.isAnonymous);

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

    if (session?.userId) {
      const userRecord = await safeDb(() =>
        prisma.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            username: true,
            displayName: true,
            ghostMode: true,
            ghostDisplayName: true,
            countryCode: true,
            currencyCode: true,
          },
        })
      );

      if (userRecord?.ghostMode) {
        isGhost = true;
        isAnonymous = true;
        const ghostName = userRecord.ghostDisplayName || (await getOrAssignGhostDisplayName(userRecord));
        authorDisplayName = ghostName;
        authorUsername = 'anonymous';
      } else if (!isAnonymous) {
        authorUsername = userRecord?.username || authorUsername;
        authorDisplayName = userRecord?.displayName || authorDisplayName;
      }
    }

    if (!authorUsername) {
      const rawUsername = (data.authorUsername || 'debater')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase()
        .substring(0, 20);
      authorUsername = rawUsername || `user_${Math.random().toString(36).substring(2, 7)}`;
      authorDisplayName = (data.authorDisplayName || authorUsername).trim().substring(0, 40);
    }

    // 1. Resolve currency and country
    const selectedCurrency = (
      data.currency ||
      data.currencyCode ||
      (session?.userId
        ? (await safeDb(() =>
            prisma.user.findUnique({
              where: { id: session.userId },
              select: { currencyCode: true },
            })
          ))?.currencyCode
        : null) ||
      'INR'
    ).toUpperCase().trim();

    const selectedCountry = (
      data.countryCode ||
      (session?.userId
        ? (await safeDb(() =>
            prisma.user.findUnique({
              where: { id: session.userId },
              select: { countryCode: true },
            })
          ))?.countryCode
        : null) ||
      'IN'
    ).toUpperCase().trim();

    const minSupport = getMinimumSupport(selectedCurrency);
    const currencyConfig = getCurrencyConfig(selectedCurrency);

    // Determine Publishing Mode: Free vs Optional Financial Backing
    let isFreePost =
      data.isFree === true ||
      (data.amountPaise === 0 && !data.amount && !data.amountRupees) ||
      (data.amount === 0 && !data.amountPaise && !data.amountRupees) ||
      (data.amountRupees === 0 && !data.amount && !data.amountPaise) ||
      (!data.isFree &&
        data.amountPaise === undefined &&
        data.amount === undefined &&
        data.amountRupees === undefined);
    let backingPaise = 0;
    let targetMinorUnits = 0;

    if (!isFreePost && (data.amountPaise !== undefined || data.amountRupees !== undefined || data.amount !== undefined)) {
      if (data.amount !== undefined && data.amount !== null) {
        targetMinorUnits = Math.round(data.amount * Math.pow(10, currencyConfig.decimals));
      } else if (data.amountRupees !== undefined && data.amountRupees !== null) {
        if (selectedCurrency === 'INR') {
          targetMinorUnits = Math.round(data.amountRupees * 100);
        } else {
          targetMinorUnits = Math.round(data.amountRupees * Math.pow(10, currencyConfig.decimals));
        }
      } else if (data.amountPaise !== undefined && data.amountPaise !== null) {
        targetMinorUnits = Math.floor(data.amountPaise);
      }

      // Check minor units against currency minimum
      if (targetMinorUnits < minSupport.minimumMinorUnits) {
        throw new ValidationError(
          `Backing an opinion requires a minimum contribution of ${minSupport.formatted} (${selectedCurrency}).`
        );
      }

      // Convert to canonical base INR paise
      backingPaise = exchangeRateService.convertToBase(targetMinorUnits, selectedCurrency);

      // Enforce ₹10 INR canonical floor (1000 paise)
      if (backingPaise < BASE_MINIMUM_SUPPORT_PAISE) {
        throw new ValidationError(
          `Backing an opinion requires a minimum contribution of ${formatINR(BASE_MINIMUM_SUPPORT_PAISE)}.`
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
      const finalDisplayName = isAnonymous ? (isGhost ? authorDisplayName : 'Anonymous') : founderUser.displayName || 'Vishal Chaudhary';

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
            isGhost,
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
            isGhost,
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
        authorDisplayName: finalDisplayName,
        published: true,
        isFounderFree: true,
        isFree: isFreePost,
        isGhost,
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

      const effectiveDisplayName = isAnonymous ? (isGhost ? authorDisplayName : 'Anonymous') : (authorDisplayName || authorUsername);

      const debate = await safeDb(() =>
        prisma.debate.create({
          data: {
            authorId,
            title: data.title.trim(),
            content: data.content.trim(),
            categoryId: category.id,
            authorUsername: isAnonymous ? 'anonymous' : authorUsername,
            authorDisplayName: effectiveDisplayName,
            isAnonymous,
            isGhost,
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
            authorDisplayName: effectiveDisplayName,
            isAnonymous,
            isGhost,
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
        authorDisplayName: effectiveDisplayName,
        isAnonymous,
        isGhost,
      };
    }

    // 4. OPTIONAL FINANCIALLY BACKED POST (Creates Pending Debate & Initiates Payment)
    const effectiveDisplayName = isAnonymous ? (isGhost ? authorDisplayName : 'Anonymous') : (authorDisplayName || authorUsername);

    const debate = await safeDb(() =>
      prisma.debate.create({
        data: {
          authorId,
          title: data.title.trim(),
          content: data.content.trim(),
          categoryId: category.id,
          authorUsername: isAnonymous ? 'anonymous' : authorUsername,
          authorDisplayName: effectiveDisplayName,
          isAnonymous,
          isGhost,
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
          authorDisplayName: effectiveDisplayName,
          isAnonymous,
          isGhost,
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
      currency: 'INR',
      countryCode: selectedCountry,
      baseAmountPaise: backingPaise,
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
      selectedCurrency,
      selectedAmount: targetMinorUnits / Math.pow(10, currencyConfig.decimals),
      countryCode: selectedCountry,
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
export const getDebateById = (id: string, currentUserId?: string | null) =>
  debateService.getDebateById(id, currentUserId);
export const updateDebateTrendingScore = (debateId: string) =>
  debateService.updateDebateTrendingScore(debateId);
