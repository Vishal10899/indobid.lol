/**
 * INDOBID DAILY — TREND SCORER
 * Calculates a deterministic 0–100 IndoBid Trend Score for each story cluster.
 */

import { StoryClusterData, TrendScoreFactors, NewsCategory, NewsRegion } from './types';

/**
 * Calculates score component for independent sources (0–35 pts)
 */
export function calculateSourceScore(sourceCount: number, independentSourcesCount: number): number {
  if (independentSourcesCount >= 4) return 35;
  if (independentSourcesCount === 3) return 28;
  if (independentSourcesCount === 2) return 20;
  if (sourceCount >= 2) return 15;
  return 10;
}

/**
 * Calculates freshness score based on how recently the story was seen (0–25 pts)
 */
export function calculateFreshnessScore(lastSeenAt: Date, now: Date = new Date()): number {
  const ageHours = Math.max(0, (now.getTime() - lastSeenAt.getTime()) / (1000 * 60 * 60));
  if (ageHours <= 2) return 25;
  if (ageHours <= 6) return 20;
  if (ageHours <= 12) return 15;
  if (ageHours <= 24) return 10;
  if (ageHours <= 36) return 5;
  return 2;
}

/**
 * Calculates velocity score: multiple sources picking up story rapidly (0–20 pts)
 */
export function calculateVelocityScore(cluster: StoryClusterData): number {
  if (cluster.independentSources.length <= 1) {
    return 5;
  }
  const timeSpanHours = Math.max(0.1, (cluster.lastSeenAt.getTime() - cluster.firstSeenAt.getTime()) / (1000 * 60 * 60));
  const ratePerHour = cluster.independentSources.length / timeSpanHours;

  if (ratePerHour >= 1.0) return 20; // 1+ new source per hour
  if (ratePerHour >= 0.5) return 15;
  if (ratePerHour >= 0.25) return 12;
  return 8;
}

/**
 * Category discussion affinity score (0–15 pts)
 */
export function calculateCategoryScore(category: NewsCategory): number {
  switch (category) {
    case 'AI':
    case 'TECHNOLOGY':
      return 15;
    case 'INDIA':
    case 'WORLD':
      return 14;
    case 'BUSINESS':
      return 12;
    case 'SCIENCE':
    case 'CLIMATE':
      return 10;
    case 'SPORTS':
    case 'CULTURE':
    default:
      return 8;
  }
}

/**
 * Geographic relevance score for IndoBid audience (0–10 pts)
 */
export function calculateGeographicScore(region: NewsRegion): number {
  switch (region) {
    case 'INDIA':
      return 10;
    case 'GLOBAL':
      return 8;
    case 'ASIA':
    case 'US':
    case 'EUROPE':
    default:
      return 7;
  }
}

/**
 * Computes the full breakdown and final trend score for a cluster
 */
export function scoreCluster(
  cluster: StoryClusterData,
  options: {
    isCooldownDuplicate?: boolean;
    now?: Date;
  } = {}
): TrendScoreFactors {
  const now = options.now || new Date();
  const indepCount = cluster.independentSources.length;
  const sourceScore = calculateSourceScore(cluster.sourceCount, indepCount);
  const freshnessScore = calculateFreshnessScore(cluster.lastSeenAt, now);
  const velocityScore = calculateVelocityScore(cluster);
  const categoryScore = calculateCategoryScore(cluster.category);
  const geoScore = calculateGeographicScore(cluster.region);
  const duplicatePenalty = options.isCooldownDuplicate ? 50 : 0;

  const rawScore = sourceScore + freshnessScore + velocityScore + categoryScore + geoScore - duplicatePenalty;
  const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    sourceCount: cluster.sourceCount,
    independentSourcesCount: indepCount,
    freshnessScore,
    velocityScore,
    categoryImportanceScore: categoryScore,
    geographicScore: geoScore,
    duplicatePenalty,
    finalScore,
  };
}
