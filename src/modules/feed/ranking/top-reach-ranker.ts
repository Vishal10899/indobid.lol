/**
 * INDOBID — TOP REACH RANKER
 * Ranks active debates by actual unique reach and impressions.
 *
 * Core Invariants:
 * 1. Reach is derived from canonical unique session impressions recorded in DebateImpression.
 * 2. Ranked by impressionCount DESC.
 * 3. Ties broken by likeCount DESC, totalVerifiedContribution DESC, and createdAt DESC.
 * 4. Ghost Mode identities are strictly masked via resolveAuthorIdentity.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { mapDebateToListItem } from '../feed.mapper';
import { DebateListItem } from '../../debates/debate.types';

export interface TopReachQueryOptions {
  category?: string;
  page?: number;
  limit?: number;
  currentUserId?: string | null;
}

export interface TopReachResult {
  items: DebateListItem[];
  debates: DebateListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TopReachRanker {
  async getTopReachDebates(options: TopReachQueryOptions = {}): Promise<TopReachResult> {
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

    const [total, debates] = await safeDb(() =>
      Promise.all([
        prisma.debate.count({ where }),
        prisma.debate.findMany({
          where,
          orderBy: [
            { impressionCount: 'desc' },
            { likeCount: 'desc' },
            { totalVerifiedContribution: 'desc' },
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

    const items = debates.map((d) => mapDebateToListItem(d, { currentUserId }));

    return {
      items,
      debates: items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }
}

export const topReachRanker = new TopReachRanker();
