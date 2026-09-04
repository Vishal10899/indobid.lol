/**
 * INDOBID — TRENDING RANKER
 * Canonical ranking for Trending, Top Paid, Top Reach, and Top Engagement.
 *
 * Core Invariants:
 * 1. Supports clear sections: Top Reach, Top Engagement, Top Paid, and Trending overall.
 * 2. Paid content does not disappear from Trending merely because it is new.
 * 3. Preserves: HIGHER CONFIRMED PAID SUPPORT = HIGHER PAID RANKING.
 * 4. Fake engagement or failed/refunded payments strictly have zero influence.
 * 5. Ghost Mode identities are strictly masked via resolveAuthorIdentity.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { calculateRankingScore } from '../ranking/ranking.service';
import { topPaidRanker } from '../ranking/top-paid-ranker';
import { topReachRanker } from '../ranking/top-reach-ranker';
import { topEngagementRanker } from '../ranking/top-engagement-ranker';
import { mapDebateToListItem } from '../feed.mapper';
import { DebateListItem } from '../../debates/debate.types';

export interface TrendingQueryOptions {
  category?: string;
  page?: number;
  limit?: number;
  currentUserId?: string | null;
}

export interface TrendingSectionsResult {
  trendingNow: DebateListItem[];
  topReach: DebateListItem[];
  topEngagement: DebateListItem[];
  topPaid: DebateListItem[];
  rising: DebateListItem[];
  newDebates: DebateListItem[];
  topDebates: DebateListItem[];
}

export class TrendingRanker {
  /**
   * Overall Trending feed: multi-signal momentum taking into account
   * confirmed backing, reach, likes, discussion depth, velocity, and freshness.
   */
  async getTrendingDebates(options: TrendingQueryOptions = {}): Promise<{
    items: DebateListItem[];
    debates: DebateListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      category = 'all',
      page = 1,
      limit = 20,
      currentUserId = null,
    } = options;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where: any = {
      status: 'active',
    };

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

    // Candidate selection from active pool using indexed ordering
    const [total, candidates] = await safeDb(() =>
      Promise.all([
        prisma.debate.count({ where }),
        prisma.debate.findMany({
          where,
          orderBy: [
            { trendingScore: 'desc' },
            { lastContributionAt: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: safeLimit,
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

    const items = candidates.map((d) => mapDebateToListItem(d, { currentUserId }));

    return {
      items,
      debates: items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Top Paid: Ranked strictly by verified financial backing.
   */
  async getTopPaid(options: TrendingQueryOptions = {}) {
    return topPaidRanker.getTopPaidDebates(options);
  }

  /**
   * Top Reach: Ranked strictly by verified unique impressions / reach.
   */
  async getTopReach(options: TrendingQueryOptions = {}) {
    return topReachRanker.getTopReachDebates(options);
  }

  /**
   * Top Engagement: Ranked strictly by likes, comments, and conversation depth.
   */
  async getTopEngagement(options: TrendingQueryOptions = {}) {
    return topEngagementRanker.getTopEngagementDebates(options);
  }

  /**
   * Aggregates all Trending sections for the Trending dashboard.
   */
  async getAllSections(options: { currentUserId?: string | null; category?: string } = {}): Promise<TrendingSectionsResult> {
    const { currentUserId = null, category = 'all' } = options;
    const limit = 10;

    const [
      trendingResult,
      topReachResult,
      topEngagementResult,
      topPaidResult,
      risingDebates,
      newestDebates,
    ] = await Promise.all([
      this.getTrendingDebates({ page: 1, limit, currentUserId, category }),
      this.getTopReach({ page: 1, limit, currentUserId, category }),
      this.getTopEngagement({ page: 1, limit, currentUserId, category }),
      this.getTopPaid({ page: 1, limit, currentUserId, category }),
      safeDb(() => {
        const where: any = { status: 'active' };
        if (category && category !== 'all') where.category = { slug: category.toLowerCase().trim() };
        return prisma.debate.findMany({
          where,
          orderBy: [{ lastContributionAt: 'desc' }, { trendingScore: 'desc' }],
          take: limit,
          include: {
            category: { select: { id: true, name: true, slug: true, icon: true } },
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
        });
      }),
      safeDb(() => {
        const where: any = { status: 'active' };
        if (category && category !== 'all') where.category = { slug: category.toLowerCase().trim() };
        return prisma.debate.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }],
          take: limit,
          include: {
            category: { select: { id: true, name: true, slug: true, icon: true } },
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
        });
      }),
    ]);

    const mappedRising = risingDebates.map((d) => mapDebateToListItem(d, { currentUserId }));
    const mappedNew = newestDebates.map((d) => mapDebateToListItem(d, { currentUserId }));

    return {
      trendingNow: trendingResult.items,
      topReach: topReachResult.items,
      topEngagement: topEngagementResult.items,
      topPaid: topPaidResult.items,
      rising: mappedRising,
      newDebates: mappedNew,
      topDebates: topPaidResult.items, // backward-compatibility alias
    };
  }
}

export const trendingRanker = new TrendingRanker();
