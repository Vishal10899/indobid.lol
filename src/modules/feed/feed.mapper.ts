/**
 * INDOBID — CANONICAL FEED ITEM MAPPER
 * Authoritative mapping of Prisma Debate records to DebateListItem and FeedItem,
 * enforcing resolveAuthorIdentity so Ghost Mode, privacy, and identity projections are 100% preserved.
 */

import { DebateListItem } from '../debates/debate.types';
import { FeedItem } from './feed.types';
import { resolveAuthorIdentity } from '../users/author-identity';
import { calculateNextMinimumPaise } from '../../lib/money';

export function mapDebateToListItem(
  d: any,
  options?: { currentUserId?: string | null }
): DebateListItem {
  const resolved = resolveAuthorIdentity(
    {
      authorId: d.authorId,
      authorUsername: d.authorUsername,
      authorDisplayName: d.authorDisplayName,
      author: d.author,
      isAnonymous: d.isAnonymous,
      isGhost: d.isGhost,
    },
    { currentUserId: options?.currentUserId }
  );

  return {
    id: d.id,
    title: d.title,
    content: d.content,
    category: d.category || {
      id: d.categoryId || '',
      name: d.categoryName || 'General',
      slug: d.categorySlug || 'general',
      icon: null,
    },
    authorId: resolved.authorId,
    authorUsername: resolved.authorUsername,
    authorDisplayName: resolved.authorDisplayName,
    authorAvatarUrl: resolved.authorAvatarUrl,
    authorIsVerified: resolved.authorIsVerified,
    authorRole: resolved.authorRole,
    originalContribution: d.originalContribution ?? 0,
    totalVerifiedContribution: d.totalVerifiedContribution ?? 0,
    contributionCount: d.contributionCount ?? 0,
    lastContributionAmount: d.lastContributionAmount ?? 0,
    minimumNextContribution: calculateNextMinimumPaise(d.lastContributionAmount ?? 0),
    trendingScore: d.trendingScore ?? 0,
    likeCount: d.likeCount ?? d._count?.likes ?? 0,
    impressionCount: d.impressionCount ?? 0,
    isAnonymous: resolved.isAnonymous,
    isGhost: resolved.isGhost,
    isClickableProfile: resolved.isClickableProfile,
    hashtags: d.hashtags || null,
    status: d.status,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt || d.createdAt,
  };
}

export function mapDebateToFeedItem(
  d: any,
  options?: { currentUserId?: string | null }
): FeedItem {
  const listItem = mapDebateToListItem(d, options);
  return {
    id: listItem.id,
    title: listItem.title,
    content: listItem.content,
    authorId: listItem.authorId || '',
    authorUsername: listItem.authorUsername,
    authorDisplayName: listItem.authorDisplayName,
    authorAvatarUrl: listItem.authorAvatarUrl || null,
    authorIsVerified: listItem.authorIsVerified || false,
    authorRole: listItem.authorRole || 'user',
    categoryId: listItem.category.id,
    categoryName: listItem.category.name,
    categorySlug: listItem.category.slug,
    totalVerifiedContribution: listItem.totalVerifiedContribution,
    contributionCount: listItem.contributionCount,
    lastContributionAmount: listItem.lastContributionAmount,
    likesCount: listItem.likeCount,
    bookmarksCount: d.bookmarkCount ?? d._count?.bookmarks ?? 0,
    trendingScore: listItem.trendingScore,
    createdAt: listItem.createdAt,
    lastContributionAt: d.lastContributionAt || listItem.createdAt,
  };
}
