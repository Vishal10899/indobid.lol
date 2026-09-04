/**
 * INDOBID — FOR YOU PERSONALIZATION SERVICE
 * Delegates to the authoritative ForYouRanker to provide personalized,
 * multi-signal ranking with author diversity and paid content priority.
 */

import { forYouRanker } from './for-you-ranker';
import { mapDebateToFeedItem } from '../feed.mapper';
import { FeedItem } from '../feed.types';

export class ForYouService {
  async getForYouFeed(params: {
    userId?: string | null;
    categoryId?: string;
    skip?: number;
    take?: number;
  }): Promise<FeedItem[]> {
    const { userId, categoryId, skip = 0, take = 20 } = params;
    const page = Math.floor(skip / take) + 1;

    const result = await forYouRanker.getForYouDebates({
      currentUserId: userId,
      category: categoryId,
      page,
      limit: take,
    });

    return result.items.map((it) => ({
      id: it.id,
      title: it.title,
      content: it.content,
      authorId: it.authorId || '',
      authorUsername: it.authorUsername,
      authorDisplayName: it.authorDisplayName,
      authorAvatarUrl: it.authorAvatarUrl || null,
      authorIsVerified: it.authorIsVerified || false,
      authorRole: it.authorRole || 'user',
      categoryId: it.category.id,
      categoryName: it.category.name,
      categorySlug: it.category.slug,
      totalVerifiedContribution: it.totalVerifiedContribution,
      contributionCount: it.contributionCount,
      lastContributionAmount: it.lastContributionAmount,
      likesCount: it.likeCount,
      bookmarksCount: 0,
      trendingScore: it.trendingScore,
      createdAt: it.createdAt,
      lastContributionAt: it.createdAt,
    }));
  }
}

export const forYouService = new ForYouService();
