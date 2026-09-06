/**
 * INDOBID DAILY — QUALITY CHECKER
 * Multi-layer quality gate ensuring high editorial standards,
 * duplicate suppression, cooldown enforcement, and daily publishing caps.
 */

import { StoryClusterData, QualityCheckResult } from './types';
import { prisma } from '@/infrastructure/database/prisma';
import { env } from '@/config/env';

export interface QualityCheckerOptions {
  minScoreThreshold?: number;
  maxDailyPosts?: number;
  cooldownHours?: number;
  bypassDailyLimit?: boolean;
}

/**
 * Validates whether a cluster passes the editorial quality criteria
 */
export async function validateClusterQuality(
  cluster: StoryClusterData,
  options: QualityCheckerOptions = {}
): Promise<QualityCheckResult> {
  const minScore = options.minScoreThreshold ?? env.TREND_SCORE_THRESHOLD ?? 50;
  const maxDaily = options.maxDailyPosts ?? env.MAX_AUTO_POSTS_PER_DAY ?? 10;
  const cooldownHours = options.cooldownHours ?? env.MIN_HOURS_BETWEEN_SAME_TOPIC ?? 24;

  // 1. Source verification
  if (!cluster.articles || cluster.articles.length === 0) {
    return { valid: false, reason: 'No articles in cluster' };
  }
  if (!cluster.independentSources || cluster.independentSources.length === 0) {
    return { valid: false, reason: 'No independent sources identified' };
  }

  // Ensure all sources have valid URLs
  const hasValidUrl = cluster.articles.some(a => {
    try {
      const u = new URL(a.articleUrl);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  });
  if (!hasValidUrl) {
    return { valid: false, reason: 'Cluster contains no valid HTTP/HTTPS source URLs' };
  }

  // 2. Title validation
  const title = cluster.canonicalTitle?.trim() || '';
  if (title.length < 15) {
    return { valid: false, reason: 'Canonical title is too short (< 15 chars)' };
  }
  if (title.length > 220) {
    return { valid: false, reason: 'Canonical title is too long (> 220 chars)' };
  }

  // 3. Trend score threshold
  if (cluster.trendScore < minScore) {
    return {
      valid: false,
      reason: `Trend score ${cluster.trendScore} is below minimum threshold of ${minScore}`,
    };
  }

  // 4. Recency check (within 36 hours)
  const now = new Date();
  const ageHours = (now.getTime() - cluster.lastSeenAt.getTime()) / (1000 * 60 * 60);
  if (ageHours > 36) {
    return { valid: false, reason: `Cluster is stale (${ageHours.toFixed(1)} hours old > 36h limit)` };
  }

  // 5. Cooldown check against recently published StoryClusters
  const cooldownCutoff = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);
  const existingPublished = await prisma.storyCluster.findFirst({
    where: {
      fingerprint: cluster.fingerprint,
      status: 'PUBLISHED',
      publishedAt: { gte: cooldownCutoff },
    },
    select: { id: true, publishedAt: true },
  });

  if (existingPublished) {
    return {
      valid: false,
      reason: `Identical cluster was published recently at ${existingPublished.publishedAt?.toISOString()}`,
    };
  }

  // 6. Daily limit check
  if (!options.bypassDailyLimit) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const publishedTodayCount = await prisma.automatedPost.count({
      where: {
        createdAt: { gte: todayStart },
      },
    });

    if (publishedTodayCount >= maxDaily) {
      return {
        valid: false,
        reason: `Daily automated publishing limit reached (${publishedTodayCount}/${maxDaily})`,
      };
    }
  }

  return { valid: true };
}
