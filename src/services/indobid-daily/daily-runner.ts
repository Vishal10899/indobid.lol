/**
 * INDOBID DAILY — ORCHESTRATOR / DAILY RUNNER
 * Orchestrates the full discovery, normalization, deduplication,
 * clustering, scoring, quality gating, and publishing pipeline.
 */

import { DailyRunResult, StoryClusterData, NewsCandidate } from './types';
import { NEWS_SOURCES } from './providers/sources';
import { fetchAllSources, RawFeedItem } from './providers/rss.provider';
import { cleanArticleUrl, normalizeTitle } from './normalizer';
import { calculateFingerprint, deduplicateBatch, filterAgainstDatabase } from './deduplicator';
import { clusterArticles } from './clusterer';
import { scoreCluster } from './trend-scorer';
import { validateClusterQuality } from './quality-checker';
import { publishStoryCluster } from './publisher';
import { prisma } from '@/infrastructure/database/prisma';
import { env } from '@/config/env';

export interface DailyRunnerOptions {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  minScore?: number;
  sourceIds?: string[];
}

export async function runDailyPipeline(options: DailyRunnerOptions = {}): Promise<DailyRunResult> {
  const startedAt = new Date();
  const isDryRun = options.dryRun !== undefined ? options.dryRun : (env.AUTO_DAILY_DRY_RUN ?? true);
  const isEnabled = env.AUTO_DAILY_ENABLED || options.force || isDryRun;
  const maxPostsPerRun = options.limit || 3;
  const minScoreThreshold = options.minScore || env.TREND_SCORE_THRESHOLD || 50;

  // 1. Initialize AutomationRun log in database
  const runRecord = await prisma.automationRun.create({
    data: {
      startedAt,
      isDryRun,
      status: 'running',
    },
  });

  const errors: string[] = [];
  const publishedPosts: DailyRunResult['publishedPosts'] = [];
  const rejectedCandidates: DailyRunResult['rejectedCandidates'] = [];

  // If engine is disabled and neither dryRun nor force is specified
  if (!isEnabled) {
    const completedAt = new Date();
    await prisma.automationRun.update({
      where: { id: runRecord.id },
      data: {
        completedAt,
        status: 'dry_run',
        summaryJson: JSON.stringify({ message: 'IndoBid Daily engine is disabled via AUTO_DAILY_ENABLED=false' }),
      },
    });

    return {
      runId: runRecord.id,
      status: 'dry_run',
      isDryRun: true,
      startedAt,
      completedAt,
      sourcesAttempted: 0,
      sourcesSuccessful: 0,
      articlesFetched: 0,
      duplicatesRemoved: 0,
      clustersCreated: 0,
      candidatesSelected: 0,
      postsPublished: 0,
      postsRejected: 0,
      publishedPosts: [],
      rejectedCandidates: [],
      errors: ['Engine disabled by configuration. Pass dryRun=true or force=true to run.'],
    };
  }

  let sourcesAttempted = 0;
  let sourcesSuccessful = 0;
  let articlesFetched = 0;
  let duplicatesRemoved = 0;
  let clustersCreated = 0;
  let candidatesSelected = 0;
  let postsPublished = 0;
  let postsRejected = 0;

  try {
    // 2. Select Sources
    let sources = NEWS_SOURCES.filter(s => s.enabled);
    if (options.sourceIds && options.sourceIds.length > 0) {
      sources = sources.filter(s => options.sourceIds?.includes(s.id));
    }
    sourcesAttempted = sources.length;

    // 3. Ingestion Phase
    const fetchResults = await fetchAllSources(sources);
    sourcesSuccessful = fetchResults.successfulCount;
    if (fetchResults.errors?.length > 0) {
      errors.push(...fetchResults.errors);
    }

    const rawArticles: NewsCandidate[] = [];

    for (const [sourceId, items] of fetchResults.results.entries()) {
      const sourceDef = sources.find(s => s.id === sourceId);
      if (!sourceDef) continue;

      for (const item of items) {
        const cleanedUrl = cleanArticleUrl(item.articleUrl);
        const normTitle = normalizeTitle(item.title);
        if (!cleanedUrl || !normTitle) continue;

        const fingerprint = calculateFingerprint(normTitle, item.publishedAt, sourceDef.category);

        rawArticles.push({
          sourceId: sourceDef.id,
          sourceName: sourceDef.name,
          title: item.title,
          normalizedTitle: normTitle,
          description: item.description,
          articleUrl: cleanedUrl,
          publishedAt: item.publishedAt,
          category: sourceDef.category,
          region: sourceDef.region,
          fingerprint,
        });
      }
    }
    articlesFetched = rawArticles.length;

    // 4. Deduplication Phase
    const batchDedup = deduplicateBatch(rawArticles);
    duplicatesRemoved += batchDedup.duplicatesCount;

    const dbDedup = await filterAgainstDatabase(batchDedup.unique);
    duplicatesRemoved += dbDedup.alreadyExistsCount;
    const freshArticles = dbDedup.freshCandidates;

    // 5. Clustering Phase
    const clusters = clusterArticles(freshArticles);
    clustersCreated = clusters.length;

    // 6. Scoring Phase
    for (const cluster of clusters) {
      const scoreResult = scoreCluster(cluster);
      cluster.trendScore = scoreResult.finalScore;
    }

    // Sort clusters by trendScore descending
    clusters.sort((a, b) => b.trendScore - a.trendScore);

    // 7. Quality Gating & Candidate Selection
    const qualifiedCandidates: StoryClusterData[] = [];

    for (const cluster of clusters) {
      const quality = await validateClusterQuality(cluster, {
        minScoreThreshold,
        bypassDailyLimit: isDryRun || options.force,
      });

      if (quality.valid) {
        qualifiedCandidates.push(cluster);
        if (qualifiedCandidates.length >= maxPostsPerRun) {
          break;
        }
      } else {
        postsRejected++;
        rejectedCandidates.push({
          title: cluster.canonicalTitle,
          reason: quality.reason || 'Failed quality check',
          trendScore: cluster.trendScore,
        });
      }
    }

    candidatesSelected = qualifiedCandidates.length;

    // 8. Publishing Phase
    if (!isDryRun) {
      for (const candidate of qualifiedCandidates) {
        try {
          const published = await publishStoryCluster(candidate);
          postsPublished++;
          publishedPosts.push({
            debateId: published.debateId,
            title: published.title,
            trendScore: candidate.trendScore,
            sourceCount: candidate.sourceCount,
            category: candidate.category,
          });
        } catch (publishErr: any) {
          errors.push(`[Publish Failed] ${candidate.canonicalTitle}: ${publishErr.message}`);
        }
      }
    } else {
      // In Dry Run, populate candidates into publishedPosts for preview
      for (const candidate of qualifiedCandidates) {
        publishedPosts.push({
          title: candidate.canonicalTitle,
          trendScore: candidate.trendScore,
          sourceCount: candidate.sourceCount,
          category: candidate.category,
        });
      }
    }
  } catch (err: any) {
    errors.push(`[Pipeline Fatal] ${err.message}`);
  }

  const completedAt = new Date();
  const finalStatus =
    errors.length > 0 && postsPublished === 0 && !isDryRun
      ? 'failed'
      : isDryRun
      ? 'dry_run'
      : errors.length > 0
      ? 'partial_failure'
      : 'success';

  // 9. Update AutomationRun record
  await prisma.automationRun.update({
    where: { id: runRecord.id },
    data: {
      completedAt,
      status: finalStatus,
      sourcesAttempted,
      sourcesSuccessful,
      articlesFetched,
      duplicatesRemoved,
      clustersCreated,
      candidatesSelected,
      postsPublished,
      postsRejected,
      summaryJson: JSON.stringify({
        publishedPosts,
        rejectedCandidates: rejectedCandidates.slice(0, 10),
      }),
      errorsJson: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return {
    runId: runRecord.id,
    status: finalStatus,
    isDryRun,
    startedAt,
    completedAt,
    sourcesAttempted,
    sourcesSuccessful,
    articlesFetched,
    duplicatesRemoved,
    clustersCreated,
    candidatesSelected,
    postsPublished,
    postsRejected,
    publishedPosts,
    rejectedCandidates,
    errors,
  };
}
