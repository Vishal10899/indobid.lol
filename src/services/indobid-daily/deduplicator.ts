/**
 * INDOBID DAILY — DEDUPLICATOR
 * Deterministic event fingerprinting, batch deduplication,
 * and database cross-checking.
 */

import crypto from 'crypto';
import { NewsCandidate } from './types';
import { extractKeywords } from './normalizer';
import { prisma } from '@/infrastructure/database/prisma';

/**
 * Calculates a deterministic event fingerprint for an article.
 * Uses top keywords + 12-hour time bucket to group identical events published
 * within roughly the same timeframe.
 */
export function calculateFingerprint(title: string, publishedAt: Date, category: string): string {
  const keywords = extractKeywords(title);
  // Pick top 6 keywords to create robust fingerprint
  const coreKeywords = keywords.slice(0, 6).join(':');

  // 12-hour time bucket (e.g. 2026-09-05-0 for 00:00-11:59, 2026-09-05-1 for 12:00-23:59)
  const d = new Date(publishedAt);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const bucket = d.getUTCHours() < 12 ? '0' : '1';
  const timeBucket = `${year}-${month}-${day}-${bucket}`;

  const payload = `${category.toLowerCase()}:${timeBucket}:${coreKeywords}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 24);
}

/**
 * Deduplicates a batch of candidates in-memory.
 * Removes duplicate URLs and exact fingerprints within the current fetched run.
 */
export function deduplicateBatch(candidates: NewsCandidate[]): {
  unique: NewsCandidate[];
  duplicatesCount: number;
} {
  const seenUrls = new Set<string>();
  const seenFingerprints = new Set<string>();
  const unique: NewsCandidate[] = [];
  let duplicatesCount = 0;

  for (const item of candidates) {
    if (seenUrls.has(item.articleUrl)) {
      duplicatesCount++;
      continue;
    }
    if (seenFingerprints.has(item.fingerprint)) {
      duplicatesCount++;
      continue;
    }

    seenUrls.add(item.articleUrl);
    seenFingerprints.add(item.fingerprint);
    unique.push(item);
  }

  return { unique, duplicatesCount };
}

/**
 * Cross-checks candidates against database records (NewsArticle table).
 * Filters out articles that have already been fetched or processed in the last 72 hours.
 */
export async function filterAgainstDatabase(
  candidates: NewsCandidate[]
): Promise<{
  freshCandidates: NewsCandidate[];
  alreadyExistsCount: number;
}> {
  if (candidates.length === 0) {
    return { freshCandidates: [], alreadyExistsCount: 0 };
  }

  const urls = candidates.map(c => c.articleUrl);
  const fingerprints = candidates.map(c => c.fingerprint);

  // Check existing URLs and fingerprints in DB
  const existingArticles = await prisma.newsArticle.findMany({
    where: {
      OR: [
        { articleUrl: { in: urls } },
        { fingerprint: { in: fingerprints } },
      ],
    },
    select: {
      articleUrl: true,
      fingerprint: true,
    },
  });

  const existingUrlSet = new Set(existingArticles.map(a => a.articleUrl));
  const existingFingerprintSet = new Set(existingArticles.map(a => a.fingerprint));

  const freshCandidates: NewsCandidate[] = [];
  let alreadyExistsCount = 0;

  for (const c of candidates) {
    if (existingUrlSet.has(c.articleUrl) || existingFingerprintSet.has(c.fingerprint)) {
      alreadyExistsCount++;
    } else {
      freshCandidates.push(c);
    }
  }

  return {
    freshCandidates,
    alreadyExistsCount,
  };
}
