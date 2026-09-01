/**
 * Deterministic Trending Algorithm for IndoBid Paid Debates
 * 
 * Based strictly on verified payment data:
 * 1. Total verified contribution value
 * 2. Recent contribution momentum (decayed over time)
 * 3. Unique participant count
 * 
 * Fake engagement, pending payments, and failed payments have ZERO weight.
 */

export interface TrendingFactors {
  totalVerifiedPaise: number;
  recent24hVerifiedPaise: number;
  recent7dVerifiedPaise: number;
  contributionCount: number;
  uniqueParticipants: number;
  lastContributionAt: Date;
  createdAt: Date;
}

/**
 * Computes deterministic trending score
 */
export function calculateTrendingScore(factors: TrendingFactors): number {
  const {
    totalVerifiedPaise,
    recent24hVerifiedPaise,
    recent7dVerifiedPaise,
    contributionCount,
    uniqueParticipants,
    lastContributionAt,
  } = factors;

  if (totalVerifiedPaise <= 0 || contributionCount <= 0) {
    return 0;
  }

  // Convert paise to rupees for scoring scale
  const totalRupees = totalVerifiedPaise / 100;
  const recent24hRupees = recent24hVerifiedPaise / 100;
  const recent7dRupees = recent7dVerifiedPaise / 100;

  // Time decay calculation based on last verified activity (hours elapsed)
  const now = Date.now();
  const lastActivityHours = Math.max(0, (now - new Date(lastContributionAt).getTime()) / (1000 * 60 * 60));
  
  // Half-life decay: ~48 hours
  const recencyDecay = Math.exp(-lastActivityHours / 48);

  // Component 1: Base value weight (logarithmic scaling for huge amounts to prevent single whale monopoly)
  const baseValueScore = Math.log10(Math.max(1, totalRupees)) * 20;

  // Component 2: 24h & 7d Velocity / Momentum weight (heavy weight for hot activity)
  const velocityScore = (recent24hRupees * 2.0) + (recent7dRupees * 0.5);

  // Component 3: Participant Diversity weight (many people debating is more interesting than 1 person)
  const participantScore = Math.min(uniqueParticipants * 15, 300);

  // Final composite score
  const score = (baseValueScore + velocityScore + participantScore) * recencyDecay;

  return Math.round(score * 100) / 100;
}
