/**
 * INDOBID — ORGANIC ENGAGEMENT SIGNAL
 * Aggregates likes, impressions, and bookmarks with logarithmic scaling.
 */

export const ENGAGEMENT_CONFIG = {
  LIKE_WEIGHT: 12,
  IMPRESSION_WEIGHT: 2.5,
  BOOKMARK_WEIGHT: 8,
};

export function calculateEngagementScore(
  likeCount: number,
  impressionCount: number,
  bookmarkCount = 0
): number {
  const likeScore = Math.log1p(Math.max(0, likeCount)) * ENGAGEMENT_CONFIG.LIKE_WEIGHT;
  const impressionScore =
    Math.log10(1 + Math.max(0, impressionCount)) * ENGAGEMENT_CONFIG.IMPRESSION_WEIGHT;
  const bookmarkScore = Math.log1p(Math.max(0, bookmarkCount)) * ENGAGEMENT_CONFIG.BOOKMARK_WEIGHT;

  return likeScore + impressionScore + bookmarkScore;
}
