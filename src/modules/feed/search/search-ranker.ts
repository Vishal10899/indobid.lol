/**
 * INDOBID — SEARCH RANKER
 * Multi-dimensional search across posts, debaters (users), and topics (categories).
 *
 * Core Ranking Formula:
 * Final Search Score = Text Relevance + Paid Priority + Engagement Quality + Recency
 *
 * Critical Invariants:
 * 1. Relevant text/topic match ALWAYS comes first.
 * 2. An unrelated $100 paid post CANNOT outrank a relevant post.
 * 3. Among posts with comparable relevance, higher confirmed backing gives ranking priority.
 * 4. Failed/refunded/unconfirmed payments have strictly zero influence.
 * 5. Ghost Mode accounts and posts never leak real identity in search responses.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { mapDebateToListItem } from '../feed.mapper';
import { DebateListItem } from '../../debates/debate.types';

export interface SearchQueryOptions {
  query: string;
  category?: string;
  page?: number;
  limit?: number;
  currentUserId?: string | null;
}

export interface SearchUserResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  role: string;
}

export interface SearchCategoryResult {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  debatesCount: number;
}

export interface SearchResult {
  posts: DebateListItem[];
  debates: DebateListItem[];
  users: SearchUserResult[];
  categories: SearchCategoryResult[];
  totalPosts: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class SearchRanker {
  /**
   * Calculates relevance score between search query and post text.
   * Returns a score from 0 to 1000.
   * If there is zero relevance to the query, returns 0.
   */
  calculateTextRelevance(query: string, post: {
    title: string;
    content: string;
    hashtags?: string | null;
    categoryName?: string;
    categorySlug?: string;
    authorUsername?: string;
    authorDisplayName?: string;
  }): number {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return 100; // neutral if no query

    const titleLower = post.title.toLowerCase();
    const contentLower = post.content.toLowerCase();
    const hashtagsLower = (post.hashtags || '').toLowerCase();
    const catNameLower = (post.categoryName || '').toLowerCase();
    const catSlugLower = (post.categorySlug || '').toLowerCase();
    const authorLower = `${post.authorUsername || ''} ${post.authorDisplayName || ''}`.toLowerCase();

    const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
    let relevance = 0;

    // 1. Exact match bonuses
    if (titleLower === cleanQuery) {
      relevance += 1000;
    } else if (titleLower.includes(cleanQuery)) {
      relevance += 600;
    }

    if (catNameLower === cleanQuery || catSlugLower === cleanQuery) {
      relevance += 400;
    } else if (catNameLower.includes(cleanQuery) || catSlugLower.includes(cleanQuery)) {
      relevance += 250;
    }

    if (hashtagsLower.includes(`#${cleanQuery}`) || hashtagsLower.includes(cleanQuery)) {
      relevance += 300;
    }

    if (contentLower.includes(cleanQuery)) {
      relevance += 150;
    }

    if (authorLower.includes(cleanQuery)) {
      relevance += 200;
    }

    // 2. Token overlap matches
    let tokenMatchesInTitle = 0;
    let tokenMatchesInContent = 0;

    for (const token of queryTokens) {
      if (titleLower.includes(token)) tokenMatchesInTitle++;
      if (contentLower.includes(token)) tokenMatchesInContent++;
      if (catNameLower.includes(token) || catSlugLower.includes(token)) relevance += 80;
      if (hashtagsLower.includes(token)) relevance += 70;
    }

    if (queryTokens.length > 0) {
      relevance += (tokenMatchesInTitle / queryTokens.length) * 300;
      relevance += (tokenMatchesInContent / queryTokens.length) * 100;
    }

    return Math.round(relevance);
  }

  /**
   * Calculates post search ranking score:
   * Score = Relevance + Paid Priority + Engagement Quality + Recency
   */
  calculatePostSearchScore(post: {
    title: string;
    content: string;
    hashtags?: string | null;
    categoryName?: string;
    categorySlug?: string;
    authorUsername?: string;
    authorDisplayName?: string;
    totalVerifiedContribution: number;
    likeCount: number;
    impressionCount: number;
    contributionCount: number;
    createdAt: Date;
  }, query: string): number {
    const textRelevance = this.calculateTextRelevance(query, post);

    // Critical Requirement: If post is completely irrelevant to query,
    // payment MUST NOT overcome relevance.
    if (query.trim() && textRelevance === 0) {
      return 0;
    }

    // 2. Paid Priority:
    // When relevance is comparable, paid posts get priority, and higher backing = higher score.
    // Floor of 20 points for any verified paid post (> 0 paise).
    // Plus logarithmic scaling on confirmed backing (caps at ~80 points).
    let paidPriority = 0;
    if (post.totalVerifiedContribution > 0) {
      paidPriority = 20 + Math.log10(1 + post.totalVerifiedContribution / 1000) * 25;
    }

    // 3. Engagement Quality (up to 40 points)
    const engagementScore = Math.log1p(
      post.likeCount * 2 + post.contributionCount * 3 + post.impressionCount * 0.05
    ) * 6;

    // 4. Recency (up to 30 points)
    const ageHours = Math.max(0, (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60));
    const recencyScore = Math.max(0, 30 * Math.exp(-ageHours / 72));

    return textRelevance + paidPriority + engagementScore + recencyScore;
  }

  /**
   * Search posts with Relevance + Paid Priority + Engagement + Recency ranking.
   */
  async searchDebates(options: SearchQueryOptions): Promise<{
    items: DebateListItem[];
    debates: DebateListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { query, category = 'all', page = 1, limit = 20, currentUserId = null } = options;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const cleanQuery = query.trim();

    const where: any = { status: 'active' };

    if (
      category &&
      category.toLowerCase() !== 'all' &&
      category.toLowerCase() !== 'for_you' &&
      category.toLowerCase() !== 'following'
    ) {
      where.category = { slug: category.toLowerCase().trim() };
    }

    if (cleanQuery) {
      where.OR = [
        { title: { contains: cleanQuery, mode: 'insensitive' } },
        { content: { contains: cleanQuery, mode: 'insensitive' } },
        { authorUsername: { contains: cleanQuery, mode: 'insensitive' } },
        { authorDisplayName: { contains: cleanQuery, mode: 'insensitive' } },
        { hashtags: { contains: cleanQuery, mode: 'insensitive' } },
        { category: { name: { contains: cleanQuery, mode: 'insensitive' } } },
        { category: { slug: { contains: cleanQuery, mode: 'insensitive' } } },
      ];
    }

    // Fetch candidate set
    const candidates = await safeDb(() =>
      prisma.debate.findMany({
        where,
        take: Math.min(150, Math.max(safeLimit * 3, 50)),
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true } },
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
              role: true,
              isPrivate: true,
              ghostMode: true,
              ghostDisplayName: true,
            },
          },
        },
      })
    );

    // Score candidates using relevance + paid priority + engagement + recency
    const scored = candidates.map((d) => {
      const score = this.calculatePostSearchScore(
        {
          title: d.title,
          content: d.content,
          hashtags: d.hashtags,
          categoryName: d.category?.name,
          categorySlug: d.category?.slug,
          authorUsername: d.authorUsername,
          authorDisplayName: d.authorDisplayName,
          totalVerifiedContribution: d.totalVerifiedContribution,
          likeCount: d.likeCount,
          impressionCount: d.impressionCount,
          contributionCount: d.contributionCount,
          createdAt: d.createdAt,
        },
        cleanQuery
      );
      return { debate: d, score };
    });

    // Sort descending by composite score
    scored.sort((a, b) => b.score - a.score);

    const total = scored.length;
    const paginated = scored.slice(skip, skip + safeLimit);
    const items = paginated.map((p) => mapDebateToListItem(p.debate, { currentUserId }));

    return {
      items,
      debates: items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Unified search across posts, debaters, and categories.
   */
  async searchAll(options: SearchQueryOptions): Promise<SearchResult> {
    const { query, category = 'all', page = 1, limit = 20, currentUserId = null } = options;
    const cleanQuery = query.trim();

    const [postResult, users, categories] = await Promise.all([
      this.searchDebates(options),
      cleanQuery
        ? safeDb(() =>
            prisma.user.findMany({
              where: {
                isSuspended: false,
                ghostMode: false, // Ghost accounts never show up in user search
                OR: [
                  { username: { contains: cleanQuery, mode: 'insensitive' } },
                  { displayName: { contains: cleanQuery, mode: 'insensitive' } },
                ],
              },
              take: 10,
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                bio: true,
                isVerified: true,
                role: true,
              },
            })
          )
        : Promise.resolve([]),
      cleanQuery
        ? safeDb(() =>
            prisma.category.findMany({
              where: {
                OR: [
                  { name: { contains: cleanQuery, mode: 'insensitive' } },
                  { slug: { contains: cleanQuery, mode: 'insensitive' } },
                ],
              },
              take: 10,
              include: {
                _count: {
                  select: { debates: { where: { status: 'active' } } },
                },
              },
            })
          )
        : Promise.resolve([]),
    ]);

    const formattedUsers: SearchUserResult[] = users.map((u) => ({
      id: u.id,
      username: u.username || 'anonymous',
      displayName: u.displayName || u.username || 'User',
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      isVerified: u.isVerified,
      role: u.role,
    }));

    const formattedCategories: SearchCategoryResult[] = categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      debatesCount: c._count.debates,
    }));

    return {
      posts: postResult.items,
      debates: postResult.items,
      users: formattedUsers,
      categories: formattedCategories,
      totalPosts: postResult.total,
      page: postResult.page,
      limit: postResult.limit,
      totalPages: postResult.totalPages,
    };
  }
}

export const searchRanker = new SearchRanker();
