/**
 * INDOBID — DEBATE TYPES
 */

export interface DebateListItem {
  id: string;
  title: string;
  content: string;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  };
  authorId?: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string | null;
  authorIsVerified?: boolean;
  authorRole?: string | null;
  originalContribution: number;
  totalVerifiedContribution: number;
  contributionCount: number;
  lastContributionAmount: number;
  minimumNextContribution: number;
  trendingScore: number;
  likeCount: number;
  impressionCount: number;
  isAnonymous: boolean;
  hashtags?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetDebatesOptions {
  category?: string;
  sort?: 'for_you' | 'highest_value' | 'trending' | 'new' | 'newest' | 'top' | 'rising' | 'active' | 'following';
  page?: number;
  limit?: number;
  search?: string;
  currentUserId?: string | null;
}

export interface CreateDebateDTO {
  title: string;
  content: string;
  categoryId?: string;
  categorySlug?: string;
  authorId?: string | null;
  authorUsername?: string;
  authorDisplayName?: string;
  isFree?: boolean;
  amountPaise?: number | null;
  amountRupees?: number | null;
  isAnonymous?: boolean;
  hashtags?: string | null;
  email?: string | null;
}

export interface UpdateDebateDTO {
  title?: string;
  content?: string;
  hashtags?: string;
}
