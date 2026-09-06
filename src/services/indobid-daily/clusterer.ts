/**
 * INDOBID DAILY — CLUSTERER
 * Groups related articles from multiple feeds into coherent story clusters.
 */

import crypto from 'crypto';
import { NewsCandidate, StoryClusterData, NewsCategory, NewsRegion } from './types';
import { extractKeywords } from './normalizer';

/**
 * Calculates Jaccard similarity coefficient between two sets of strings
 */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize > 0 ? intersectionSize / unionSize : 0;
}

/**
 * Determines whether two candidates are discussing the same underlying event
 */
function areArticlesRelated(a: NewsCandidate, b: NewsCandidate): boolean {
  // Must be in the same general category (or both tech/ai)
  const isCategoryCompatible =
    a.category === b.category ||
    (['TECHNOLOGY', 'AI'].includes(a.category) && ['TECHNOLOGY', 'AI'].includes(b.category)) ||
    (['WORLD', 'INDIA', 'BUSINESS'].includes(a.category) && ['WORLD', 'INDIA', 'BUSINESS'].includes(b.category));

  if (!isCategoryCompatible) return false;

  // Time delta must be within 36 hours
  const timeDeltaHours = Math.abs(a.publishedAt.getTime() - b.publishedAt.getTime()) / (1000 * 60 * 60);
  if (timeDeltaHours > 36) return false;

  const keywordsA = new Set(extractKeywords(a.normalizedTitle));
  const keywordsB = new Set(extractKeywords(b.normalizedTitle));

  const jaccard = calculateJaccardSimilarity(keywordsA, keywordsB);
  if (jaccard >= 0.35) return true;

  // Check absolute overlap count for longer titles
  let sharedCount = 0;
  for (const k of keywordsA) {
    if (keywordsB.has(k)) {
      sharedCount++;
    }
  }

  // If 3+ meaningful keywords match, high chance of same story
  return sharedCount >= 3;
}

/**
 * Selects the highest quality canonical title from a cluster of articles
 */
export function selectCanonicalTitle(articles: NewsCandidate[]): string {
  if (articles.length === 1) return articles[0].normalizedTitle;

  // High-reliability source priority
  const sourcePriority: Record<string, number> = {
    reuters: 10,
    bbc: 9,
    'ap-news': 9,
    'the-hindu': 8,
    techcrunch: 8,
    'the-verge': 8,
    mint: 7,
    'indian-express': 7,
  };

  let bestTitle = articles[0].normalizedTitle;
  let bestScore = -1;

  for (const art of articles) {
    const title = art.normalizedTitle;
    let score = 0;

    // Length preference: 45 to 110 chars is optimal for headlines
    const len = title.length;
    if (len >= 45 && len <= 110) {
      score += 25;
    } else if (len >= 30 && len <= 130) {
      score += 15;
    } else {
      score += 5;
    }

    // Source authority
    const sPriority = sourcePriority[art.sourceId] || 5;
    score += sPriority * 3;

    // Penalize exclamation marks or clickbait indicators
    if (title.includes('!')) score -= 10;
    if (title.toUpperCase() === title) score -= 20; // ALL CAPS

    if (score > bestScore) {
      bestScore = score;
      bestTitle = title;
    }
  }

  return bestTitle;
}

/**
 * Clusters an array of normalized candidates into StoryClusterData structures
 */
export function clusterArticles(candidates: NewsCandidate[]): StoryClusterData[] {
  if (candidates.length === 0) return [];

  const clusters: NewsCandidate[][] = [];

  for (const candidate of candidates) {
    let matchedCluster: NewsCandidate[] | null = null;

    for (const cluster of clusters) {
      // Compare with any article in cluster (or representative first)
      const representative = cluster[0];
      if (areArticlesRelated(candidate, representative)) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }

  // Convert candidate groups into StoryClusterData
  return clusters.map(articles => {
    const canonicalTitle = selectCanonicalTitle(articles);
    const uniqueSources = Array.from(new Set(articles.map(a => a.sourceName)));

    // Determine representative category and region
    const categoryCounts: Record<string, number> = {};
    const regionCounts: Record<string, number> = {};

    for (const art of articles) {
      categoryCounts[art.category] = (categoryCounts[art.category] || 0) + 1;
      regionCounts[art.region] = (regionCounts[art.region] || 0) + 1;
    }

    const dominantCategory = (Object.keys(categoryCounts).reduce((a, b) =>
      categoryCounts[a] >= categoryCounts[b] ? a : b
    ) as NewsCategory) || articles[0].category;

    const dominantRegion = (Object.keys(regionCounts).reduce((a, b) =>
      regionCounts[a] >= regionCounts[b] ? a : b
    ) as NewsRegion) || articles[0].region;

    // Timestamps
    const timestamps = articles.map(a => a.publishedAt.getTime());
    const firstSeenAt = new Date(Math.min(...timestamps));
    const lastSeenAt = new Date(Math.max(...timestamps));

    // Cluster deterministic fingerprint based on top keywords
    const keywords = extractKeywords(canonicalTitle).slice(0, 5).join(':');
    const d = new Date(firstSeenAt);
    const dateBucket = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const fingerprint = crypto
      .createHash('sha256')
      .update(`cluster:${dominantCategory}:${dateBucket}:${keywords}`)
      .digest('hex')
      .substring(0, 24);

    return {
      fingerprint,
      canonicalTitle,
      category: dominantCategory,
      region: dominantRegion,
      articles,
      sourceCount: articles.length,
      independentSources: uniqueSources,
      firstSeenAt,
      lastSeenAt,
      trendScore: 0,
      status: 'NEW',
    };
  });
}
