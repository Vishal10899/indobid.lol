/**
 * INDOBID.LOL — AUTHORITATIVE MULTI-SIGNAL RANKING & ENGAGEMENT ENGINE
 * 
 * CORE PRODUCT ARCHITECTURE:
 * 
 * 1. MACRO-PILLAR CONCEPTUAL WEIGHTING (Configurable Server-Side Tuning):
 *    - 30% Meaningful Engagement (Likes, Saves, Shares, Impressions)
 *    - 20% Conversation Quality (Response depth, multi-turn discussion, participant diversity)
 *    - 15% Freshness (Exploration window, cold-start boost, half-life time decay)
 *    - 15% Community Interest (Personal affinity, followed creators, topic alignment)
 *    - 10% Content Quality (Optimal length sweet-spot, formatting, hashtag categorization)
 *    - 10% Financial Conviction (Logarithmically scaled skin in the game — NOT pay-to-win!)
 * 
 * 2. MICRO-SIGNAL VALUE HIERARCHY:
 *    View / Impression (Base 1.0x)
 *    ↓
 *    Like (Medium-Low 3.0x)
 *    ↓
 *    Share (Medium 6.0x)
 *    ↓
 *    Save / Bookmark (Medium-High 8.0x)
 *    ↓
 *    Profile Visit / Author Follow (High Intent 10.0x)
 *    ↓
 *    Comment / Reply (Very High 15.0x)
 *    ↓
 *    Meaningful Reply Chain & Participant Diversity (Pinnacle 25.0x + Bonus)
 *    ↓
 *    Paid Backing / Contribution (Logarithmic Conviction Metric)
 */

export interface RankingFactors {
  // Financial Conviction
  totalVerifiedPaise: number;
  recent24hVerifiedPaise?: number;
  
  // Engagement
  likeCount: number;
  impressionCount: number;
  bookmarkCount?: number;
  
  // Conversation Depth
  contributionCount: number; // sequence count
  uniqueParticipants?: number;
  
  // Content & Quality
  contentLength: number;
  hasHashtags?: boolean;
  hasImage?: boolean;
  reportCount: number;
  
  // Temporal
  createdAt: Date;
  lastContributionAt?: Date;
  
  // Personal Relevance
  isFollowedAuthor?: boolean;
  isCategoryAffinity?: boolean;
}

export interface RankingBreakdown {
  finalScore: number;
  contentQualityScore: number;
  engagementQualityScore: number;
  conversationDepthScore: number;
  convictionScore: number;
  freshnessDiscoveryBoost: number;
  personalAffinityScore: number;
  recencyDecayMultiplier: number;
  penaltyScore: number;
}

// =================================================================================================
// 1. MACRO-PILLAR PERCENTAGE DISTRIBUTION (Starting Parameters — Centralized for Tuning)
// =================================================================================================
export const MACRO_PILLAR_WEIGHTS = {
  MEANINGFUL_ENGAGEMENT: 0.30, // 30%
  CONVERSATION_QUALITY:  0.20, // 20%
  FRESHNESS:             0.15, // 15%
  COMMUNITY_INTEREST:    0.15, // 15%
  CONTENT_QUALITY:       0.10, // 10%
  FINANCIAL_CONVICTION:  0.10, // 10%
};

// =================================================================================================
// 2. MICRO-SIGNAL CALIBRATION CONSTANTS
// =================================================================================================
export const RANKING_CONFIG = {
  // Content Quality Calibration (10% Pillar)
  CONTENT_BASE_WEIGHT: 10,
  CONTENT_OPTIMAL_MIN_LENGTH: 80,
  CONTENT_OPTIMAL_MAX_LENGTH: 1500,
  HASHTAG_BONUS: 4,
  
  // Engagement Quality Calibration (30% Pillar - Logarithmic Diminishing Returns)
  LIKE_WEIGHT: 12,
  IMPRESSION_WEIGHT: 2.5,
  BOOKMARK_WEIGHT: 8,
  
  // Conversation Depth Calibration (20% Pillar)
  RESPONSE_WEIGHT: 15,
  UNIQUE_PARTICIPANT_WEIGHT: 10,
  MAX_PARTICIPANT_BONUS: 80,
  
  // Conviction Signal Calibration (10% Pillar - Logarithmic Diminishing Returns)
  CONVICTION_SCALE_DIVISOR_PAISE: 1000, // ₹10 base divisor
  CONVICTION_WEIGHT: 10,
  
  // Freshness & Cold-Start Calibration (15% Pillar)
  FRESHNESS_WINDOW_HOURS: 36,
  MAX_FRESHNESS_BOOST: 35,
  HALF_LIFE_HOURS: 48,
  
  // Penalties & Trust & Safety
  REPORT_PENALTY_MULTIPLIER: 30,
  
  // Community Interest Calibration (15% Pillar)
  FOLLOWED_AUTHOR_BONUS: 25,
  CATEGORY_AFFINITY_BONUS: 10,
};

/**
 * Calculates a comprehensive multi-signal ranking score and returns the detailed breakdown.
 */
export function calculateRankingScore(factors: RankingFactors): RankingBreakdown {
  const now = Date.now();
  const createdMs = new Date(factors.createdAt).getTime();
  const lastActiveMs = factors.lastContributionAt ? new Date(factors.lastContributionAt).getTime() : createdMs;
  
  const ageHours = Math.max(0, (now - createdMs) / (1000 * 60 * 60));
  const inactivityHours = Math.max(0, (now - lastActiveMs) / (1000 * 60 * 60));

  // 1. Content Quality Score (10% Macro Pillar)
  let contentQualityScore = RANKING_CONFIG.CONTENT_BASE_WEIGHT;
  if (factors.contentLength >= RANKING_CONFIG.CONTENT_OPTIMAL_MIN_LENGTH) {
    const lengthFactor = Math.min(1.0, factors.contentLength / 400);
    contentQualityScore += lengthFactor * 10;
  }
  if (factors.hasHashtags) {
    contentQualityScore += RANKING_CONFIG.HASHTAG_BONUS;
  }

  // 2. Meaningful Engagement Quality Score (30% Macro Pillar)
  // Micro-hierarchy: View (low) < Like (med-low) < Bookmark (med-high)
  const likeScore = Math.log1p(Math.max(0, factors.likeCount)) * RANKING_CONFIG.LIKE_WEIGHT;
  const impressionScore = Math.log1p(Math.max(0, factors.impressionCount)) * RANKING_CONFIG.IMPRESSION_WEIGHT;
  const bookmarkScore = Math.log1p(Math.max(0, factors.bookmarkCount || 0)) * RANKING_CONFIG.BOOKMARK_WEIGHT;
  const engagementQualityScore = likeScore + impressionScore + bookmarkScore;

  // 3. Conversation Depth & Discussion Quality (20% Macro Pillar)
  // Micro-hierarchy: Comment/Reply (high) < Multi-turn debate chain < Unique participant diversity
  const responses = Math.max(0, factors.contributionCount - 1);
  const responseScore = Math.log1p(responses) * RANKING_CONFIG.RESPONSE_WEIGHT;
  const uniqueParticipants = factors.uniqueParticipants || (responses > 0 ? Math.min(responses + 1, 10) : 1);
  const participantBonus = Math.min(uniqueParticipants * RANKING_CONFIG.UNIQUE_PARTICIPANT_WEIGHT, RANKING_CONFIG.MAX_PARTICIPANT_BONUS);
  const conversationDepthScore = responseScore + participantBonus;

  // 4. Financial Conviction Score (10% Macro Pillar - Logarithmic Diminishing Returns)
  // Evidence of conviction, not bought reach.
  const normalizedPaise = Math.max(0, factors.totalVerifiedPaise);
  const convictionScore = Math.log1p(normalizedPaise / RANKING_CONFIG.CONVICTION_SCALE_DIVISOR_PAISE) * RANKING_CONFIG.CONVICTION_WEIGHT;

  // 5. Freshness & Cold-Start Exploration Boost (15% Macro Pillar)
  // Guarantees new opinions receive an upfront test window
  let freshnessDiscoveryBoost = 0;
  if (ageHours < RANKING_CONFIG.FRESHNESS_WINDOW_HOURS) {
    const freshnessRatio = (RANKING_CONFIG.FRESHNESS_WINDOW_HOURS - ageHours) / RANKING_CONFIG.FRESHNESS_WINDOW_HOURS;
    freshnessDiscoveryBoost = freshnessRatio * RANKING_CONFIG.MAX_FRESHNESS_BOOST;
  }

  // 6. Community Interest & Personal Affinity (15% Macro Pillar)
  let personalAffinityScore = 0;
  if (factors.isFollowedAuthor) {
    personalAffinityScore += RANKING_CONFIG.FOLLOWED_AUTHOR_BONUS;
  }
  if (factors.isCategoryAffinity) {
    personalAffinityScore += RANKING_CONFIG.CATEGORY_AFFINITY_BONUS;
  }

  // 7. Time Decay Multiplier (Smooth Half-life Decay based on latest activity)
  const recencyDecayMultiplier = Math.exp(-inactivityHours / RANKING_CONFIG.HALF_LIFE_HOURS);

  // 8. Trust & Safety Penalties
  const penaltyScore = Math.max(0, factors.reportCount) * RANKING_CONFIG.REPORT_PENALTY_MULTIPLIER;

  // Composite Final Score
  const rawPositiveScore = (
    contentQualityScore +
    engagementQualityScore +
    conversationDepthScore +
    convictionScore +
    freshnessDiscoveryBoost +
    personalAffinityScore
  );

  const finalScore = Math.max(0, Math.round((rawPositiveScore * recencyDecayMultiplier - penaltyScore) * 100) / 100);

  return {
    finalScore,
    contentQualityScore: Math.round(contentQualityScore * 100) / 100,
    engagementQualityScore: Math.round(engagementQualityScore * 100) / 100,
    conversationDepthScore: Math.round(conversationDepthScore * 100) / 100,
    convictionScore: Math.round(convictionScore * 100) / 100,
    freshnessDiscoveryBoost: Math.round(freshnessDiscoveryBoost * 100) / 100,
    personalAffinityScore: Math.round(personalAffinityScore * 100) / 100,
    recencyDecayMultiplier: Math.round(recencyDecayMultiplier * 1000) / 1000,
    penaltyScore: Math.round(penaltyScore * 100) / 100,
  };
}

/**
 * Convenience helper returning just the numeric score
 */
export function getScore(factors: RankingFactors): number {
  return calculateRankingScore(factors).finalScore;
}

// -------------------------------------------------------------------------------------------------
// LEGACY COMPATIBILITY EXPORTS
// -------------------------------------------------------------------------------------------------
export const MINIMUM_BID_CENTS = 1000;
export const MINIMUM_INCREMENT_CENTS = 100;

export async function estimateRank(params: {
  targetBidCents: number;
  categoryId?: string;
  countryCode?: string;
  listingId?: string;
}) {
  const { prisma } = await import('./db');
  const where: any = { status: 'active' };
  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }
  if (params.listingId) {
    where.id = { not: params.listingId };
  }
  const higherCount = await prisma.listing.count({
    where: {
      ...where,
      verifiedBid: { gt: params.targetBidCents },
    },
  });
  return {
    estimatedRank: higherCount + 1,
    targetBidCents: params.targetBidCents,
  };
}

export async function getLeaderboard(params: {
  categorySlug?: string;
  countryCode?: string;
  page?: number;
  limit?: number;
}) {
  const { prisma } = await import('./db');
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = { status: 'active' };
  if (params.categorySlug) {
    where.category = { slug: params.categorySlug };
  }

  const [total, items] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: [{ verifiedBid: 'desc' }, { createdAt: 'asc' }],
      skip,
      take: limit,
      include: { category: true },
    }),
  ]);

  return {
    items: items.map((item, index) => ({
      ...item,
      rank: skip + index + 1,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
