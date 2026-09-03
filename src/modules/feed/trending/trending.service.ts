/**
 * INDOBID — TRENDING MOMENTUM SERVICE
 */

import { calculateRankingScore } from '../ranking/ranking.service';

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

export function calculateTrendingScore(factors: TrendingFactors): number {
  const {
    totalVerifiedPaise = 0,
    recent24hVerifiedPaise = 0,
    contributionCount = 1,
    uniqueParticipants,
    likeCount = 0,
    impressionCount = 0,
    lastContributionAt,
    createdAt,
    reportCount = 0,
  } = factors;

  const breakdown = calculateRankingScore({
    totalVerifiedPaise,
    recent24hVerifiedPaise,
    likeCount,
    impressionCount,
    contributionCount,
    uniqueParticipants: uniqueParticipants || Math.max(1, contributionCount),
    contentLength: 200,
    reportCount,
    createdAt,
    lastContributionAt,
  });

  return breakdown.finalScore;
}

export class TrendingService {
  calculateTrendingScore(factors: TrendingFactors): number {
    return calculateTrendingScore(factors);
  }
}

export const trendingService = new TrendingService();
