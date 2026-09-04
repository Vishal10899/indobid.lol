/**
 * INDOBID — UNIFIED FEED SERVICE
 * Canonical architectural gateway uniting all rankers:
 *  ├── ForYouRanker
 *  ├── FollowingRanker
 *  ├── TrendingRanker
 *  ├── TopPaidRanker
 *  ├── TopReachRanker
 *  ├── TopEngagementRanker
 *  └── SearchRanker
 */

import { forYouRanker, ForYouRanker, ForYouQueryOptions, ForYouResult } from './for-you/for-you-ranker';
import { followingRanker, FollowingRanker, FollowingQueryOptions, FollowingResult } from './following/following-ranker';
import { trendingRanker, TrendingRanker, TrendingQueryOptions, TrendingSectionsResult } from './trending/trending-ranker';
import { topPaidRanker, TopPaidRanker, TopPaidQueryOptions, TopPaidResult } from './ranking/top-paid-ranker';
import { topReachRanker, TopReachRanker, TopReachQueryOptions, TopReachResult } from './ranking/top-reach-ranker';
import { topEngagementRanker, TopEngagementRanker, TopEngagementQueryOptions, TopEngagementResult } from './ranking/top-engagement-ranker';
import { searchRanker, SearchRanker, SearchQueryOptions, SearchResult } from './search/search-ranker';
import { FeedItem, FeedQueryOptions } from './feed.types';
import { mapDebateToFeedItem } from './feed.mapper';

export class FeedService {
  readonly forYouRanker: ForYouRanker = forYouRanker;
  readonly followingRanker: FollowingRanker = followingRanker;
  readonly trendingRanker: TrendingRanker = trendingRanker;
  readonly topPaidRanker: TopPaidRanker = topPaidRanker;
  readonly topReachRanker: TopReachRanker = topReachRanker;
  readonly topEngagementRanker: TopEngagementRanker = topEngagementRanker;
  readonly searchRanker: SearchRanker = searchRanker;

  /**
   * Universal feed query dispatcher.
   */
  async getFeed(options: FeedQueryOptions = {}): Promise<FeedItem[]> {
    const {
      feedType = 'for_you',
      categoryId,
      search,
      skip = 0,
      take = 20,
      userId,
    } = options;

    const page = Math.floor(skip / take) + 1;

    if (search && search.trim()) {
      const searchRes = await this.searchRanker.searchDebates({
        query: search,
        category: categoryId,
        page,
        limit: take,
        currentUserId: userId,
      });
      return searchRes.items.map((it) => mapDebateToFeedItem(it, { currentUserId: userId }));
    }

    if (feedType === 'for_you') {
      const result = await this.forYouRanker.getForYouDebates({
        currentUserId: userId,
        category: categoryId,
        page,
        limit: take,
      });
      return result.items.map((it) => mapDebateToFeedItem(it, { currentUserId: userId }));
    }

    if (feedType === 'following') {
      const result = await this.followingRanker.getFollowingDebates({
        currentUserId: userId,
        page,
        limit: take,
      });
      return result.items.map((it) => mapDebateToFeedItem(it, { currentUserId: userId }));
    }

    if (feedType === 'trending') {
      const result = await this.trendingRanker.getTrendingDebates({
        category: categoryId,
        page,
        limit: take,
        currentUserId: userId,
      });
      return result.items.map((it) => mapDebateToFeedItem(it, { currentUserId: userId }));
    }

    // Default: Top Paid / Highest Value
    const result = await this.topPaidRanker.getTopPaidDebates({
      category: categoryId,
      page,
      limit: take,
      currentUserId: userId,
    });
    return result.items.map((it) => mapDebateToFeedItem(it, { currentUserId: userId }));
  }

  // Direct Ranker Access Methods
  async getForYou(options: ForYouQueryOptions): Promise<ForYouResult> {
    return this.forYouRanker.getForYouDebates(options);
  }

  async getFollowing(options: FollowingQueryOptions): Promise<FollowingResult> {
    return this.followingRanker.getFollowingDebates(options);
  }

  async getTrending(options: TrendingQueryOptions) {
    return this.trendingRanker.getTrendingDebates(options);
  }

  async getTopPaid(options: TopPaidQueryOptions): Promise<TopPaidResult> {
    return this.topPaidRanker.getTopPaidDebates(options);
  }

  async getTopReach(options: TopReachQueryOptions): Promise<TopReachResult> {
    return this.topReachRanker.getTopReachDebates(options);
  }

  async getTopEngagement(options: TopEngagementQueryOptions): Promise<TopEngagementResult> {
    return this.topEngagementRanker.getTopEngagementDebates(options);
  }

  async search(options: SearchQueryOptions): Promise<SearchResult> {
    return this.searchRanker.searchAll(options);
  }

  async getTrendingSections(options: { currentUserId?: string | null; category?: string } = {}): Promise<TrendingSectionsResult> {
    return this.trendingRanker.getAllSections(options);
  }
}

export const feedService = new FeedService();
