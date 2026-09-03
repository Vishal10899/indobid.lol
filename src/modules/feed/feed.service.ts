/**
 * INDOBID — UNIFIED FEED SERVICE
 * Gateway for the 3 locked feed modes: For You, Trending, Following.
 */

import { forYouService, FeedItem } from './for-you/for-you.service';
import { followingFeedService } from './following/following.service';
import { prisma } from '../../infrastructure/database/prisma';
import { safeDb } from '../../infrastructure/database/transactions';

export interface FeedQueryOptions {
  feedType?: 'for_you' | 'trending' | 'following' | 'recent';
  categoryId?: string;
  authorId?: string;
  search?: string;
  skip?: number;
  take?: number;
  userId?: string | null;
}

export class FeedService {
  async getFeed(options: FeedQueryOptions = {}): Promise<FeedItem[]> {
    const {
      feedType = 'for_you',
      categoryId,
      authorId,
      search,
      skip = 0,
      take = 20,
      userId,
    } = options;

    if (feedType === 'for_you' && !search && !authorId) {
      return forYouService.getForYouFeed({ userId, categoryId, skip, take });
    }

    if (feedType === 'following' && userId && !search && !authorId && !categoryId) {
      return followingFeedService.getFollowingFeed({ userId, skip, take });
    }

    // Standard filter & search query
    const where: any = { status: 'active' };
    if (categoryId) where.categoryId = categoryId;
    if (authorId) where.authorId = authorId;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { authorUsername: { contains: q, mode: 'insensitive' } },
        { authorDisplayName: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    let orderBy: any = [{ createdAt: 'desc' }];
    if (feedType === 'trending') {
      orderBy = [{ trendingScore: 'desc' }, { createdAt: 'desc' }];
    }

    const debates = await safeDb(() =>
      prisma.debate.findMany({
        where,
        orderBy,
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

export const feedService = new FeedService();
