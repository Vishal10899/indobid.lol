/**
 * INDOBID — SEARCH RELEVANCE SCORING ENGINE
 * Ranks search results primarily by textual and semantic relevance.
 * Confirmed paid conviction adds a modest sublinear boost, ensuring:
 * 1. Relevance strictly dominates unrelated money: An unrelated $100 post CANNOT beat a relevant post.
 * 2. Where relevance is comparable: $100 > $10 > $1 > unpaid.
 * 3. Unpaid posts receive 0 paid boost.
 */

export interface SearchCandidate {
  id: string;
  title: string;
  content: string;
  hashtags?: string | null;
  category?: { name: string; slug: string } | null;
  authorUsername?: string;
  authorDisplayName?: string;
  totalVerifiedContribution: number; // in paise
  createdAt: Date;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function calculateSearchRelevanceScore(
  item: SearchCandidate,
  rawQuery: string
): number {
  if (!rawQuery || !rawQuery.trim()) {
    return 0;
  }

  const query = rawQuery.toLowerCase().trim();
  const queryTerms = query.split(/\s+/).filter((t) => t.length > 0);

  const titleLower = (item.title || '').toLowerCase();
  const contentLower = (item.content || '').toLowerCase();
  const hashtagsLower = (item.hashtags || '').toLowerCase();
  const categoryNameLower = (item.category?.name || '').toLowerCase();
  const categorySlugLower = (item.category?.slug || '').toLowerCase();
  const authorUsernameLower = (item.authorUsername || '').toLowerCase();
  const authorDisplayNameLower = (item.authorDisplayName || '').toLowerCase();

  let relevanceScore = 0;

  // 1. Exact phrase matches (Highest relevance)
  if (titleLower === query) {
    relevanceScore += 120; // Exact title match
  } else if (titleLower.includes(query)) {
    relevanceScore += 100; // Title contains exact query phrase
  }

  // 2. Word boundary / token matches in Title
  let titleTermsMatched = 0;
  for (const term of queryTerms) {
    const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
    if (termRegex.test(titleLower)) {
      relevanceScore += 35;
      titleTermsMatched++;
    } else if (titleLower.includes(term)) {
      relevanceScore += 20;
      titleTermsMatched++;
    }
  }

  // Bonus if ALL terms matched in title
  if (queryTerms.length > 1 && titleTermsMatched === queryTerms.length) {
    relevanceScore += 25;
  }

  // 3. Hashtag matches
  if (hashtagsLower.includes(`#${query}`) || hashtagsLower.includes(query)) {
    relevanceScore += 40;
  }

  // 4. Category matches
  if (categorySlugLower === query || categoryNameLower === query) {
    relevanceScore += 30;
  } else if (categoryNameLower.includes(query) || categorySlugLower.includes(query)) {
    relevanceScore += 20;
  }

  // 5. Author name match
  if (authorUsernameLower === query || authorDisplayNameLower === query) {
    relevanceScore += 25;
  }

  // 6. Content body matches (Subordinate to Title/Category)
  let contentMatches = 0;
  for (const term of queryTerms) {
    const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
    const matches = (contentLower.match(termRegex) || []).length;
    if (matches > 0) {
      contentMatches += Math.min(3, matches); // Capped to prevent keyword stuffing
    } else if (contentLower.includes(term)) {
      contentMatches += 1;
    }
  }
  relevanceScore += Math.min(20, contentMatches * 4); // Max 20 points from body text

  // If query is present and relevanceScore is 0 (zero match anywhere),
  // return 0 so completely unrelated posts cannot match or rank
  if (relevanceScore === 0) {
    return 0;
  }

  // 7. Sublinear Financial Conviction Booster
  // Scaled so:
  // - Unpaid ($0) = 0 pts
  // - Verified paid (> 0) gets a 1.0 pt baseline priority over unpaid
  // - $1 (100p) ≈ 1.0 + 0.2 = 1.2 pts
  // - $5 (500p) ≈ 1.0 + 0.9 = 1.9 pts
  // - $10 (1000p) ≈ 1.0 + 1.5 = 2.5 pts
  // - $25 (2500p) ≈ 1.0 + 2.7 = 3.7 pts
  // - $100 (10000p) ≈ 1.0 + 5.2 = 6.2 pts
  // - $500 (50000p) ≈ 1.0 + 8.5 = 9.5 pts
  // This guarantees: $100 > $10 > $1 > unpaid among comparable relevance,
  // while an unrelated post with 0 relevance gets 0 total.
  const paise = Math.max(0, item.totalVerifiedContribution || 0);
  const paidBoost = paise > 0
    ? 1.0 + Math.min(10, Math.round(5 * Math.log10(1 + paise / 1000) * 10) / 10)
    : 0;

  return relevanceScore + paidBoost;
}
