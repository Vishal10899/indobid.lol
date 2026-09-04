/**
 * INDOBID — FOLLOWING FEED SERVICE
 * Delegates to FollowingRanker to provide active debates from followed creators.
 */

import { followingRanker } from './following-ranker';
import { FeedItem } from '../feed.types';

export class FollowingFeedService {
  async getFollowingFeed(params: {
    userId: string;
    skip?: number;
    take?: number;
  }): Promise<FeedItem[]> {
    const { userId, skip = 0, take = 20 } = params;
    const page = Math.floor(skip / take) + 1;

    const result = await followingRanker.getFollowingDebates({
      currentUserId: userId,
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

export const followingFeedService = new FollowingFeedService();
