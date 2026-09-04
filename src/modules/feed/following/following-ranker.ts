/**
 * INDOBID — FOLLOWING RANKER
 * Strictly serves debates authored by creators the user follows.
 *
 * Core Invariants:
 * 1. Only returns active verified debates from creators the user follows.
 * 2. Does not mix unrelated global content into the Following feed.
 * 3. Supports paid priority among followed creators: higher backing gives ranking boost.
 * 4. Ghost Mode identities are strictly masked via resolveAuthorIdentity.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { mapDebateToListItem } from '../feed.mapper';
import { DebateListItem } from '../../debates/debate.types';

export interface FollowingQueryOptions {
  userId?: string | null;
  currentUserId?: string | null;
  page?: number;
  limit?: number;
}

export interface FollowingResult {
  items: DebateListItem[];
  debates: DebateListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class FollowingRanker {
  async getFollowingDebates(options: FollowingQueryOptions = {}): Promise<FollowingResult> {
    const targetUserId = options.userId || options.currentUserId || null;
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    if (!targetUserId) {
      return {
        items: [],
        debates: [],
        total: 0,
        page,
        limit,
        totalPages: 1,
      };
    }

    // 1. Get followed creator IDs
    const follows = await safeDb(() =>
      prisma.follow.findMany({
        where: { followerId: targetUserId },
        select: { followingId: true },
      })
    );

    const followingIds = follows.map((f) => f.followingId);

    if (followingIds.length === 0) {
      return {
        items: [],
        debates: [],
        total: 0,
        page,
        limit,
        totalPages: 1,
      };
    }

    const where: any = {
      status: 'active',
      authorId: { in: followingIds },
    };

    // 2. Query debates from followed creators
    // Order by recency and confirmed paid backing
    const [total, debates] = await safeDb(() =>
      Promise.all([
        prisma.debate.count({ where }),
        prisma.debate.findMany({
          where,
          orderBy: [
            { totalVerifiedContribution: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
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

    const items = debates.map((d) => mapDebateToListItem(d, { currentUserId: targetUserId }));

    return {
      items,
      debates: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const followingRanker = new FollowingRanker();
