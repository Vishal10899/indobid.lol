import { calculateRankingScore } from './ranking';

/**
 * Deterministic Trending Algorithm for IndoBid Social & Economic Conversations
 * 
 * Supports both Free Opinions and Financially Backed Opinions.
 * Momentum is driven by:
 * 1. Conversation depth & unique participants
 * 2. Recent response velocity (decayed over time)
 * 3. Verified engagement (likes, saves, reads)
 * 4. Normalized economic conviction (logarithmic scaling)
 */

export interface TrendingFactors {
  totalVerifiedPaise: number;
  recent24hVerifiedPaise?: number;
  recent7dVerifiedPaise?: number;
  contributionCount: number;
  uniqueParticipants?: number;
  likeCount?: number;
  impressionCount?: number;
  lastContributionAt: Date;
  createdAt: Date;
  reportCount?: number;
}

/**
 * Computes deterministic trending score
 */
export function calculateTrendingScore(factors: TrendingFactors): number {
  const {
    totalVerifiedPaise = 0,
    recent24hVerifiedPaise = 0,
    recent7dVerifiedPaise = 0,
    contributionCount = 1,
    uniqueParticipants,
    likeCount = 0,
    impressionCount = 0,
    lastContributionAt,
    createdAt,
    reportCount = 0,
  } = factors;

  // Utilize the multi-signal ranking engine
  const breakdown = calculateRankingScore({
    totalVerifiedPaise,
    recent24hVerifiedPaise,
    likeCount,
    impressionCount,
    contributionCount,
    uniqueParticipants: uniqueParticipants || Math.max(1, contributionCount),
    contentLength: 200, // standard baseline
    reportCount,
    createdAt,
    lastContributionAt,
  });

  return breakdown.finalScore;
}
