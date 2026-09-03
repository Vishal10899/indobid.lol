/**
 * INDOBID — PERSONAL AFFINITY SIGNAL
 * Calculates personalization bonus for followed creators and category affinities.
 */

export const AFFINITY_CONFIG = {
  FOLLOWED_AUTHOR_BONUS: 25,
  CATEGORY_AFFINITY_BONUS: 10,
};

export function calculateAffinityScore(isFollowedAuthor = false, isCategoryAffinity = false): number {
  let score = 0;
  if (isFollowedAuthor) score += AFFINITY_CONFIG.FOLLOWED_AUTHOR_BONUS;
  if (isCategoryAffinity) score += AFFINITY_CONFIG.CATEGORY_AFFINITY_BONUS;
  return score;
}
