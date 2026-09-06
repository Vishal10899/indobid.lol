/**
 * INDOBID DAILY — SOURCE REGISTRY
 * Configurable registry of legitimate, public, free RSS and Atom feeds.
 * No paid News API keys. No scraping of restricted sites.
 */

import { NewsSource } from '../types';

export const NEWS_SOURCES: NewsSource[] = [
  // ─── WORLD NEWS ─────────────────────────────────────────────────────────────
  {
    id: 'bbc-world',
    name: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'WORLD',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.2,
    reliabilityScore: 0.95,
  },
  {
    id: 'npr-world',
    name: 'NPR World',
    url: 'https://feeds.npr.org/1004/rss.xml',
    category: 'WORLD',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.92,
  },
  {
    id: 'aljazeera-world',
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'WORLD',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.0,
    reliabilityScore: 0.88,
  },
  {
    id: 'dw-world',
    name: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    category: 'WORLD',
    region: 'EUROPE',
    enabled: true,
    weight: 1.0,
    reliabilityScore: 0.90,
  },
  {
    id: 'un-news',
    name: 'UN News',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    category: 'WORLD',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.95,
  },

  // ─── INDIA NEWS ─────────────────────────────────────────────────────────────
  {
    id: 'the-hindu-national',
    name: 'The Hindu',
    url: 'https://www.thehindu.com/news/national/feeder/default.rss',
    category: 'INDIA',
    region: 'INDIA',
    enabled: true,
    weight: 1.2,
    reliabilityScore: 0.94,
  },
  {
    id: 'ndtv-india',
    name: 'NDTV',
    url: 'https://feeds.feedburner.com/ndtvnews-top-stories',
    category: 'INDIA',
    region: 'INDIA',
    enabled: true,
    weight: 1.0,
    reliabilityScore: 0.88,
  },
  {
    id: 'indian-express',
    name: 'Indian Express',
    url: 'https://indianexpress.com/section/india/feed/',
    category: 'INDIA',
    region: 'INDIA',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.90,
  },

  // ─── TECHNOLOGY & AI ────────────────────────────────────────────────────────
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'TECHNOLOGY',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.2,
    reliabilityScore: 0.95,
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'TECHNOLOGY',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.90,
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'TECHNOLOGY',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.0,
    reliabilityScore: 0.88,
  },
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'AI',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.25,
    reliabilityScore: 0.96,
  },
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://news.ycombinator.com/rss',
    category: 'TECHNOLOGY',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.0,
    reliabilityScore: 0.85,
  },

  // ─── BUSINESS & MARKETS ─────────────────────────────────────────────────────
  {
    id: 'marketwatch-top',
    name: 'MarketWatch',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    category: 'BUSINESS',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.92,
  },
  {
    id: 'cnbc-business',
    name: 'CNBC',
    url: 'https://search.cnbc.com/rs/search/view.html?partnerId=2000&keywords=business&format=rss',
    category: 'BUSINESS',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.91,
  },
  {
    id: 'bbc-business',
    name: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    category: 'BUSINESS',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.93,
  },

  // ─── SCIENCE & CLIMATE ──────────────────────────────────────────────────────
  {
    id: 'phys-org',
    name: 'Phys.org',
    url: 'https://phys.org/rss-feed/',
    category: 'SCIENCE',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.0,
    reliabilityScore: 0.92,
  },
  {
    id: 'sciencedaily',
    name: 'ScienceDaily',
    url: 'https://www.sciencedaily.com/rss/top/science.xml',
    category: 'SCIENCE',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.0,
    reliabilityScore: 0.91,
  },
  {
    id: 'nasa-breaking',
    name: 'NASA',
    url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    category: 'SCIENCE',
    region: 'GLOBAL',
    enabled: true,
    weight: 1.1,
    reliabilityScore: 0.98,
  },

  // ─── SPORTS & CULTURE ───────────────────────────────────────────────────────
  {
    id: 'bbc-sport',
    name: 'BBC Sport',
    url: 'https://feeds.bbci.co.uk/sport/rss.xml',
    category: 'SPORTS',
    region: 'GLOBAL',
    enabled: true,
    weight: 0.9,
    reliabilityScore: 0.90,
  },
  {
    id: 'espn',
    name: 'ESPN',
    url: 'https://www.espn.com/espn/rss/news',
    category: 'SPORTS',
    region: 'GLOBAL',
    enabled: true,
    weight: 0.9,
    reliabilityScore: 0.88,
  },
  {
    id: 'npr-culture',
    name: 'NPR Culture',
    url: 'https://feeds.npr.org/1008/rss.xml',
    category: 'CULTURE',
    region: 'GLOBAL',
    enabled: true,
    weight: 0.95,
    reliabilityScore: 0.92,
  },
];

export function getEnabledSources(): NewsSource[] {
  return NEWS_SOURCES.filter((s) => s.enabled);
}

export function getSourcesByCategory(category: string): NewsSource[] {
  const norm = category.toUpperCase().trim();
  return NEWS_SOURCES.filter((s) => s.enabled && s.category === norm);
}
