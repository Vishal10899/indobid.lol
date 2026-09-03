/**
 * INDOBID — FOR YOU PERSONALIZATION SERVICE
 * Extracts user affinity from likes/bookmarks and enforces author diversity (<= 2 consecutive slots).
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { calculateRankingScore } from '../ranking/ranking.service';
import { FeedItem } from '../feed.types';

export class ForYouService {
  async getForYouFeed(params: {
    userId?: string | null;
    categoryId?: string;
    skip?: number;
    take?: number;
  }): Promise<FeedItem[]> {
    const { userId, categoryId, skip = 0, take = 20 } = params;

    let followedAuthorIds = new Set<string>();
    let affinityCategoryIds = new Set<string>();

    if (userId) {
      const [follows, likes, bookmarks] = await Promise.all([
        safeDb(() =>
          prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
          })
        ),
        safeDb(() =>
          prisma.debateLike.findMany({
            where: { userId },
            select: { debate: { select: { categoryId: true } } },
            take: 30,
            orderBy: { createdAt: 'desc' },
          })
        ),
        safeDb(() =>
          prisma.debateBookmark.findMany({
            where: { userId },
            select: { debate: { select: { categoryId: true } } },
            take: 30,
            orderBy: { createdAt: 'desc' },
          })
        ),
      ]);

      followedAuthorIds = new Set(follows.map((f) => f.followingId));
      likes.forEach((l) => l.debate?.categoryId && affinityCategoryIds.add(l.debate.categoryId));
      bookmarks.forEach((b) => b.debate?.categoryId && affinityCategoryIds.add(b.debate.categoryId));
    }

    const where: any = { status: 'active' };
    if (categoryId) where.categoryId = categoryId;

    const candidates = await safeDb(() =>
      prisma.debate.findMany({
        where,
        take: Math.min(100, Math.max(take * 3, 50)),
        orderBy: [{ trendingScore: 'desc' }, { createdAt: 'desc' }],
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

    const scoredCandidates = candidates.map((d) => {
      const isFollowedAuthor = Boolean(d.authorId && followedAuthorIds.has(d.authorId));
      const isCategoryAffinity = affinityCategoryIds.has(d.categoryId);

      const ranking = calculateRankingScore({
        likeCount: d._count.likes,
        bookmarkCount: d._count.bookmarks,
        impressionCount: d.impressionCount || 0,
        contributionCount: d._count.contributions,
        uniqueParticipants: Math.max(1, d.contributionCount),
        totalVerifiedPaise: d.totalVerifiedContribution,
        createdAt: d.createdAt,
        lastContributionAt: d.lastContributionAt,
        reportCount: d.reportCount,
        contentLength: d.content.length,
        hasHashtags: d.content.includes('#'),
        isFollowedAuthor,
        isCategoryAffinity,
      });

      const item: FeedItem = {
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
      };

      return { item, dynamicScore: ranking.finalScore };
    });

    scoredCandidates.sort((a, b) => b.dynamicScore - a.dynamicScore);

    // Apply author diversity: prevent one author from occupying > 2 consecutive slots
    const diversified: FeedItem[] = [];
    const pool = [...scoredCandidates];
    let lastAuthor = '';
    let consecutiveAuthorCount = 0;

    while (pool.length > 0) {
      let pickIndex = 0;
      if (lastAuthor && consecutiveAuthorCount >= 2) {
        const altIndex = pool.findIndex((p) => p.item.authorUsername !== lastAuthor);
        if (altIndex !== -1) {
          pickIndex = altIndex;
        }
      }

      const picked = pool.splice(pickIndex, 1)[0];
      if (picked.item.authorUsername === lastAuthor) {
        consecutiveAuthorCount++;
      } else {
        lastAuthor = picked.item.authorUsername;
        consecutiveAuthorCount = 1;
      }
      diversified.push(picked.item);
    }

    return diversified.slice(skip, skip + take);
  }
}

export const forYouService = new ForYouService();
