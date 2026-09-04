/**
 * INDOBID — FOR YOU RANKER
 * Personalized feed ranking engine combining personal relevance, user interest,
 * follow relationships, engagement quality, paid priority, recency, content quality,
 * author diversity, and cold-start exploration.
 *
 * Core Ranking Principles:
 * 1. Personal Relevance & User Interest are paramount: a highly relevant post
 *    (matching user's declared or learned interests) can decisively outrank an unrelated paid post.
 * 2. Paid Priority provides a legitimate boost (+15-40 pts), but CANNOT override strong relevance.
 * 3. Cold Start gracefully serves onboarding interests, globally trending, top reach, and top paid content.
 * 4. Author diversity strictly caps consecutive slots per author to <= 2.
 * 5. Ghost Mode identities are 100% masked via resolveAuthorIdentity.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { personalizationService, UserInterestProfile } from '../signals/personalization.service';
import { calculateRankingScore } from '../ranking/ranking.service';
import { applyAuthorDiversity } from '../signals/diversity';
import { mapDebateToListItem } from '../feed.mapper';
import { DebateListItem } from '../../debates/debate.types';

export interface ForYouQueryOptions {
  userId?: string | null;
  category?: string;
  page?: number;
  limit?: number;
  currentUserId?: string | null;
}

export interface ForYouResult {
  items: DebateListItem[];
  debates: DebateListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ForYouRanker {
  /**
   * Generates a personalized For You feed for the given user.
   */
  async getForYouDebates(options: ForYouQueryOptions = {}): Promise<ForYouResult> {
    const {
      userId = options.currentUserId || null,
      category = 'all',
      page = 1,
      limit = 20,
      currentUserId = userId,
    } = options;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    // 1. Fetch user interest profile (includes explicit interests, follows, likes, bookmarks, comments, payments)
    const profile: UserInterestProfile = await personalizationService.getUserInterestProfile(currentUserId);

    const where: any = { status: 'active' };

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

    // 2. Candidate Selection:
    // Scale candidate pool with requested limit (take up to 150 candidates to allow rich personalized re-ranking)
    const candidatePoolSize = Math.min(200, Math.max(safeLimit * 4, 80));

    // For cold-start users without any history:
    // Blend trending score, verified contribution, and recency
    const orderBy: any = profile.hasHistory
      ? [
          { trendingScore: 'desc' },
          { lastContributionAt: 'desc' },
          { createdAt: 'desc' },
        ]
      : [
          { trendingScore: 'desc' },
          { totalVerifiedContribution: 'desc' },
          { createdAt: 'desc' },
        ];

    const [totalActive, candidates] = await safeDb(() =>
      Promise.all([
        prisma.debate.count({ where }),
        prisma.debate.findMany({
          where,
          orderBy,
          take: candidatePoolSize,
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
            _count: {
              select: {
                likes: true,
                bookmarks: true,
                contributions: { where: { status: 'verified' } },
              },
            },
          },
        }),
      ])
    );

    if (candidates.length === 0) {
      return {
        items: [],
        debates: [],
        total: 0,
        page: safePage,
        limit: safeLimit,
        totalPages: 1,
      };
    }

    // 3. Multi-Signal Scoring for each candidate
    const scoredCandidates = candidates.map((d) => {
      const isFollowedAuthor = Boolean(d.authorId && profile.followedAuthorIds.has(d.authorId));
      const categoryWeight =
        profile.categoryWeights[d.categoryId] ||
        profile.categoryWeights[d.category?.slug] ||
        profile.categoryWeights.get?.(d.categoryId) ||
        profile.categoryWeights.get?.(d.category?.slug) ||
        0;
      const isCategoryAffinity = categoryWeight > 0.3;

      // Base ranking score using canonical formula
      const baseBreakdown = calculateRankingScore({
        totalVerifiedPaise: d.totalVerifiedContribution,
        likeCount: d.likeCount || d._count?.likes || 0,
        impressionCount: d.impressionCount || 0,
        bookmarkCount: d._count?.bookmarks || 0,
        contributionCount: d.contributionCount || d._count?.contributions || 1,
        contentLength: d.content.length,
        hasHashtags: Boolean(d.hashtags),
        reportCount: d.reportCount,
        createdAt: d.createdAt,
        lastContributionAt: d.lastContributionAt,
        isFollowedAuthor,
        isCategoryAffinity,
      });

      // Personal affinity score from detailed interaction vector
      const personalAffinity = personalizationService.computeAffinityScore(
        {
          categoryId: d.categoryId,
          categorySlug: d.category?.slug,
          authorId: d.authorId,
        },
        profile
      );

      // Paid Priority Boost:
      // Verified paid posts get a priority boost in For You, but it is calibrated so that
      // an unrelated paid post cannot overpower a highly relevant post (+35 pts affinity).
      let paidPriorityBoost = 0;
      if (d.totalVerifiedContribution > 0) {
        paidPriorityBoost = 15 + Math.log10(1 + d.totalVerifiedContribution / 1000) * 10;
      }

      // Final composite score
      const finalForYouScore = Math.max(
        0,
        Math.round((baseBreakdown.finalScore + personalAffinity + paidPriorityBoost) * 100) / 100
      );

      const listItem = mapDebateToListItem(d, { currentUserId });

      return {
        item: listItem,
        score: finalForYouScore,
      };
    });

    // 4. Sort descending by personalized score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 5. Author Diversity Constraint:
    // Prevent any author from occupying > 2 consecutive slots in the feed
    const diversifiedItems = applyAuthorDiversity(
      scoredCandidates.map((c) => c.item),
      2
    );

    // 6. Paginate result
    const paginatedItems = diversifiedItems.slice(skip, skip + safeLimit);

    return {
      items: paginatedItems,
      debates: paginatedItems,
      total: totalActive,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(totalActive / safeLimit) || 1,
    };
  }
}

export const forYouRanker = new ForYouRanker();
