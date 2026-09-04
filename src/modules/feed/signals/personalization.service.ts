/**
 * INDOBID — PERSONALIZATION SIGNAL ENGINE
 * Aggregates behavioral signals across follows, explicit profile interests,
 * financial backings, contributions/comments, bookmarks, and likes
 * to construct a dynamic, weighted interest vector for the For You feed.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';

function createCategoryWeights(): Record<string, number> & { get: (key: string) => number | undefined } {
  const weights: Record<string, number> = {};
  Object.defineProperty(weights, 'get', {
    value: function (key: string) {
      return (this as any)[key];
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return weights as Record<string, number> & { get: (key: string) => number | undefined };
}

export interface UserInterestProfile {
  userId: string;
  categoryWeights: Record<string, number> & {
    get?: (key: string) => number | undefined;
  };
  followedAuthorIds: Set<string>;
  interactedAuthorIds: Set<string>;
  hasHistory: boolean;
}

export class PersonalizationService {
  /**
   * Builds an authoritative user interest profile from all available signals.
   */
  async getUserInterestProfile(userId?: string | null): Promise<UserInterestProfile> {
    const profile: UserInterestProfile = {
      userId: userId || '',
      categoryWeights: createCategoryWeights(),
      followedAuthorIds: new Set<string>(),
      interactedAuthorIds: new Set<string>(),
      hasHistory: false,
    };

    if (!userId) {
      return profile;
    }

    try {
      const [
        userRecord,
        follows,
        likes,
        bookmarks,
        contributions,
        payments,
      ] = await safeDb(() =>
        Promise.all([
          // 1. Explicit profile interests
          prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, interests: true },
          }),
          // 2. Followed creators
          prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
            take: 100,
          }),
          // 3. Liked debates
          prisma.debateLike.findMany({
            where: { userId },
            select: {
              debate: { select: { id: true, categoryId: true, authorId: true } },
            },
            take: 50,
            orderBy: { createdAt: 'desc' },
          }),
          // 4. Bookmarked debates
          prisma.debateBookmark.findMany({
            where: { userId },
            select: {
              debate: { select: { id: true, categoryId: true, authorId: true } },
            },
            take: 50,
            orderBy: { createdAt: 'desc' },
          }),
          // 5. User's comments / continuations
          prisma.contribution.findMany({
            where: { authorId: userId },
            select: {
              debate: { select: { id: true, categoryId: true, authorId: true } },
            },
            take: 50,
            orderBy: { createdAt: 'desc' },
          }),
          // 6. User's financial conviction / backed debates
          prisma.payment.findMany({
            where: {
              OR: [
                { debate: { authorId: userId } },
                { contribution: { authorId: userId } },
              ],
              status: 'succeeded',
            },
            select: {
              debate: { select: { id: true, categoryId: true, authorId: true } },
            },
            take: 50,
            orderBy: { createdAt: 'desc' },
          }),
        ])
      );

      const rawCategoryScores = new Map<string, number>();

      // Record Follows
      follows.forEach((f) => profile.followedAuthorIds.add(f.followingId));

      // 1. Process explicit user interests (weight = 3.0)
      if (userRecord?.interests) {
        let interestTokens: string[] = [];
        try {
          const parsed = JSON.parse(userRecord.interests);
          if (Array.isArray(parsed)) {
            interestTokens = parsed.map((p) => String(p).trim().toLowerCase()).filter((t) => t.length > 0);
          }
        } catch {
          // Not JSON format
        }
        if (interestTokens.length === 0) {
          interestTokens = userRecord.interests
            .replace(/[\[\]"']/g, ' ')
            .split(/[,;\s]+/)
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0);
        }

        if (interestTokens.length > 0) {
          profile.hasHistory = true;
          // Resolve category IDs or match slugs
          const matchedCategories = await safeDb(() =>
            prisma.category.findMany({
              where: {
                OR: [
                  { slug: { in: interestTokens } },
                  { name: { in: interestTokens, mode: 'insensitive' } },
                ],
              },
              select: { id: true, slug: true },
            })
          );

          matchedCategories.forEach((cat) => {
            rawCategoryScores.set(cat.id, (rawCategoryScores.get(cat.id) || 0) + 3.0);
            rawCategoryScores.set(cat.slug, (rawCategoryScores.get(cat.slug) || 0) + 3.0);
          });
        }
      }

      // 2. Financial Backing signals (weight = 3.5 — Highest conviction)
      payments.forEach((p) => {
        if (p.debate?.categoryId) {
          rawCategoryScores.set(p.debate.categoryId, (rawCategoryScores.get(p.debate.categoryId) || 0) + 3.5);
          profile.hasHistory = true;
        }
        if (p.debate?.authorId && p.debate.authorId !== userId) {
          profile.interactedAuthorIds.add(p.debate.authorId);
        }
      });

      // 3. User comments / conversation participations (weight = 2.0)
      contributions.forEach((c) => {
        if (c.debate?.categoryId) {
          rawCategoryScores.set(c.debate.categoryId, (rawCategoryScores.get(c.debate.categoryId) || 0) + 2.0);
          profile.hasHistory = true;
        }
        if (c.debate?.authorId && c.debate.authorId !== userId) {
          profile.interactedAuthorIds.add(c.debate.authorId);
        }
      });

      // 4. Bookmarks (weight = 2.0)
      bookmarks.forEach((b) => {
        if (b.debate?.categoryId) {
          rawCategoryScores.set(b.debate.categoryId, (rawCategoryScores.get(b.debate.categoryId) || 0) + 2.0);
          profile.hasHistory = true;
        }
        if (b.debate?.authorId && b.debate.authorId !== userId) {
          profile.interactedAuthorIds.add(b.debate.authorId);
        }
      });

      // 5. Likes (weight = 1.5)
      likes.forEach((l) => {
        if (l.debate?.categoryId) {
          rawCategoryScores.set(l.debate.categoryId, (rawCategoryScores.get(l.debate.categoryId) || 0) + 1.5);
          profile.hasHistory = true;
        }
        if (l.debate?.authorId && l.debate.authorId !== userId) {
          profile.interactedAuthorIds.add(l.debate.authorId);
        }
      });

      if (profile.followedAuthorIds.size > 0) {
        profile.hasHistory = true;
      }

      // Normalize category weights to [0, 1] relative to the user's highest affinity category
      let maxScore = 0;
      for (const score of rawCategoryScores.values()) {
        if (score > maxScore) maxScore = score;
      }

      if (maxScore > 0) {
        for (const [key, score] of rawCategoryScores.entries()) {
          profile.categoryWeights[key] = score / maxScore;
        }
      }

      return profile;
    } catch (error) {
      console.error('Error building user interest profile:', error);
      return profile;
    }
  }

  /**
   * Computes the personal affinity score for a debate item given the user's profile.
   * Boosts content in topics the user engages with, boosts followed/interacted creators,
   * and gives zero affinity to uninteracted / irrelevant categories.
   */
  computeAffinityScore(
    item: { categoryId: string; categorySlug?: string; authorId?: string | null },
    profile: UserInterestProfile
  ): number {
    if (!profile.hasHistory) {
      return 0; // Cold start: neutral affinity, rely on freshness + conviction + trending
    }

    let score = 0;

    // 1. Creator affinity
    if (item.authorId) {
      if (profile.followedAuthorIds.has(item.authorId)) {
        score += 25; // Followed creator bonus
      } else if (profile.interactedAuthorIds.has(item.authorId)) {
        score += 15; // Interacted/backed creator bonus
      }
    }

    // 2. Category / Topic affinity (up to +35 points)
    const categoryWeight =
      (typeof profile.categoryWeights.get === 'function'
        ? profile.categoryWeights.get(item.categoryId)
        : profile.categoryWeights[item.categoryId]) ||
      (item.categorySlug
        ? typeof profile.categoryWeights.get === 'function'
          ? profile.categoryWeights.get(item.categorySlug)
          : profile.categoryWeights[item.categorySlug]
        : 0) ||
      0;

    if (categoryWeight > 0) {
      score += Math.round(categoryWeight * 35);
    }

    return score;
  }
}

export const personalizationService = new PersonalizationService();
