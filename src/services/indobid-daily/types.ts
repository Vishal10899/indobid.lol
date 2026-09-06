/**
 * INDOBID DAILY — TYPES & DOMAIN INTERFACES
 */

export type NewsCategory =
  | 'WORLD'
  | 'INDIA'
  | 'TECHNOLOGY'
  | 'AI'
  | 'BUSINESS'
  | 'SCIENCE'
  | 'CLIMATE'
  | 'SPORTS'
  | 'CULTURE';

export type NewsRegion = 'GLOBAL' | 'INDIA' | 'US' | 'ASIA' | 'EUROPE';

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  category: NewsCategory;
  region: NewsRegion;
  enabled: boolean;
  weight?: number;
  reliabilityScore?: number;
}

export interface NewsCandidate {
  sourceId: string;
  sourceName: string;
  title: string;
  normalizedTitle: string;
  description?: string;
  articleUrl: string;
  publishedAt: Date;
  category: NewsCategory;
  region: NewsRegion;
  fingerprint: string;
}

export type ClusterStatus = 'NEW' | 'CANDIDATE' | 'GENERATED' | 'PUBLISHED' | 'REJECTED';

export interface StoryClusterData {
  id?: string;
  fingerprint: string;
  canonicalTitle: string;
  category: NewsCategory;
  region: NewsRegion;
  articles: NewsCandidate[];
  sourceCount: number;
  independentSources: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  trendScore: number;
  status: ClusterStatus;
  rejectionReason?: string;
}

export interface GeneratedPostContent {
  title: string;
  content: string;
  categorySlug: string;
  hashtags: string;
  sourcesList: Array<{ name: string; url: string; title: string }>;
  generationMethod: 'editorial_deterministic' | 'ai_curated';
  summaryContext: string;
  discussionQuestion: string;
}

export interface QualityCheckResult {
  valid: boolean;
  reason?: string;
}

export interface TrendScoreFactors {
  sourceCount: number;
  independentSourcesCount: number;
  freshnessScore: number;
  velocityScore: number;
  categoryImportanceScore: number;
  geographicScore: number;
  duplicatePenalty: number;
  finalScore: number;
}

export interface DailyRunResult {
  runId: string;
  status: 'success' | 'partial_failure' | 'failed' | 'dry_run';
  isDryRun: boolean;
  startedAt: Date;
  completedAt: Date;
  sourcesAttempted: number;
  sourcesSuccessful: number;
  articlesFetched: number;
  duplicatesRemoved: number;
  clustersCreated: number;
  candidatesSelected: number;
  postsPublished: number;
  postsRejected: number;
  publishedPosts: Array<{
    debateId?: string;
    title: string;
    trendScore: number;
    sourceCount: number;
    category: string;
  }>;
  rejectedCandidates: Array<{
    title: string;
    reason: string;
    trendScore: number;
  }>;
  errors: string[];
}
