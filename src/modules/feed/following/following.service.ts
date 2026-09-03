/**
 * INDOBID — FOLLOWING FEED SERVICE
 * Strictly returns active debates authored by creators the user follows.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { FeedItem } from '../for-you/for-you.service';

export class FollowingFeedService {
  async getFollowingFeed(params: {
    userId: string;
    skip?: number;
    take?: number;
  }): Promise<FeedItem[]> {
    const { userId, skip = 0, take = 20 } = params;

    const follows = await safeDb(() =>
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      })
    );

    const followingIds = follows.map((f) => f.followingId);
    if (followingIds.length === 0) return [];

    const debates = await safeDb(() =>
      prisma.debate.findMany({
        where: {
          status: 'active',
          authorId: { in: followingIds },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
              role: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
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
      })
    );

    return debates.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      authorId: d.author?.id || d.authorId || '',
      authorUsername: d.author?.username || d.authorUsername || 'anonymous',
      authorDisplayName: d.author?.displayName || d.authorDisplayName || 'Debater',
      authorAvatarUrl: d.author?.avatarUrl || null,
      authorIsVerified: d.author?.isVerified || false,
      authorRole: d.author?.role || 'user',
      categoryId: d.category.id,
      categoryName: d.category.name,
      categorySlug: d.category.slug,
      totalVerifiedContribution: d.totalVerifiedContribution,
      contributionCount: d.contributionCount,
      lastContributionAmount: d.lastContributionAmount,
      likesCount: d._count.likes,
      bookmarksCount: d._count.bookmarks,
      trendingScore: d.trendingScore,
      createdAt: d.createdAt,
      lastContributionAt: d.lastContributionAt,
    }));
  }
}

export const followingFeedService = new FollowingFeedService();
