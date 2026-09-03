/**
 * INDOBID — FEED TYPES
 */

export interface FeedItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorIsVerified: boolean;
  authorRole: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  totalVerifiedContribution: number;
  contributionCount: number;
  lastContributionAmount: number | null;
  likesCount: number;
  bookmarksCount: number;
  trendingScore: number;
  createdAt: Date;
  lastContributionAt: Date | null;
}

export interface FeedQueryOptions {
  feedType?: 'for_you' | 'trending' | 'following' | 'recent';
  categoryId?: string;
  authorId?: string;
  search?: string;
  skip?: number;
  take?: number;
  userId?: string | null;
}
