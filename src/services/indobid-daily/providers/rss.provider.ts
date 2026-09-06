/**
 * INDOBID DAILY — RSS & ATOM FEED PROVIDER
 * Lightweight, zero-dependency, resilient parser for public feeds.
 */

import { NewsSource } from '../types';

export interface RawFeedItem {
  sourceId: string;
  sourceName: string;
  title: string;
  articleUrl: string;
  publishedAt: Date;
  description?: string;
  category: NewsSource['category'];
  region: NewsSource['region'];
}

const FEED_TIMEOUT_MS = 6000;
const USER_AGENT = 'IndoBid-Daily/1.0 (+https://indobid.lol; editorial bot)';

/**
 * Unescapes HTML entities and CDATA wrappers
 */
export function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8212;/g, '—')
    .replace(/&#8211;/g, '–')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        return String.fromCharCode(parseInt(code, 10));
      } catch {
        return '';
      }
    })
    .trim();
}

/**
 * Strips HTML tags and excessive whitespace
 */
export function stripHtmlTags(str: string): string {
  if (!str) return '';
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts inner content of a tag from a block of XML
 */
function extractTagContent(block: string, tag: string): string | null {
  // Check CDATA first: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const cdataMatch = block.match(cdataRegex);
  if (cdataMatch && cdataMatch[1]) {
    return cdataMatch[1].trim();
  }

  // Standard tag match: <tag...>content</tag>
  const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(tagRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

/**
 * Parses link from XML block (supports both RSS <link> and Atom <link href="..."/>)
 */
function extractLink(block: string): string | null {
  // Atom format: <link href="https://..." rel="alternate"/>
  const atomHrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (atomHrefMatch && atomHrefMatch[1]) {
    return atomHrefMatch[1].trim();
  }

  // RSS format: <link>https://...</link>
  const rssLinkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  if (rssLinkMatch && rssLinkMatch[1]) {
    const raw = rssLinkMatch[1].trim();
    return decodeXmlEntities(raw);
  }

  // Fallback to <guid isPermaLink="true">https://...</guid>
  const guidMatch = block.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i);
  if (guidMatch && guidMatch[1]) {
    return decodeXmlEntities(guidMatch[1].trim());
  }

  return null;
}

/**
 * Parses publication date from RSS/Atom tags
 */
function parsePublishDate(block: string): Date {
  const dateTags = ['pubDate', 'published', 'updated', 'dc:date', 'lastBuildDate'];
  for (const tag of dateTags) {
    const rawDate = extractTagContent(block, tag);
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return new Date();
}

/**
 * Parses raw XML string into structured feed items
 */
export function parseFeedXml(xml: string, source: NewsSource): RawFeedItem[] {
  if (!xml || typeof xml !== 'string') return [];

  const items: RawFeedItem[] = [];

  // Match RSS <item> blocks or Atom <entry> blocks
  const isAtom = /<feed[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml) || /<entry[\s>]/i.test(xml);
  const blockRegex = isAtom ? /<entry[\s>]([\s\S]*?)<\/entry>/gi : /<item[\s>]([\s\S]*?)<\/item>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml)) !== null) {
    const block = match[1];
    if (!block) continue;

    const rawTitle = extractTagContent(block, 'title');
    if (!rawTitle) continue;

    const cleanTitle = stripHtmlTags(decodeXmlEntities(rawTitle));
    if (cleanTitle.length < 10) continue;

    const link = extractLink(block);
    if (!link || (!link.startsWith('http://') && !link.startsWith('https://'))) {
      continue;
    }

    const rawDesc =
      extractTagContent(block, 'description') ||
      extractTagContent(block, 'summary') ||
      extractTagContent(block, 'content:encoded') ||
      extractTagContent(block, 'content') ||
      '';
    const cleanDesc = stripHtmlTags(decodeXmlEntities(rawDesc)).substring(0, 500);

    const publishedAt = parsePublishDate(block);

    items.push({
      sourceId: source.id,
      sourceName: source.name,
      title: cleanTitle,
      articleUrl: link,
      publishedAt,
      description: cleanDesc || undefined,
      category: source.category,
      region: source.region,
    });
  }

  return items;
}

export class RssProvider {
  /**
   * Fetches and parses a single news source with strict timeout and defensive error isolation
   */
  async fetchFeed(source: NewsSource): Promise<{ success: boolean; items: RawFeedItem[]; error?: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8',
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timer);

      if (!response.ok) {
        return {
          success: false,
          items: [],
          error: `HTTP ${response.status} ${response.statusText}`,
        };
      }

      const xml = await response.text();
      const items = parseFeedXml(xml, source);

      return {
        success: true,
        items,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isAbort = err.name === 'AbortError';
      const errorMsg = isAbort ? `Connection timed out after ${FEED_TIMEOUT_MS}ms` : err.message || 'Fetch error';
      return {
        success: false,
        items: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Fetches multiple feeds concurrently with a concurrency limit
   */
  async fetchAllFeeds(
    sources: NewsSource[],
    concurrency = 4
  ): Promise<{ results: Map<string, RawFeedItem[]>; successfulCount: number; failedCount: number; errors: string[] }> {
    const results = new Map<string, RawFeedItem[]>();
    const errors: string[] = [];
    let successfulCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchPromises = batch.map(async (source) => {
        const res = await this.fetchFeed(source);
        if (res.success) {
          results.set(source.id, res.items);
          successfulCount++;
        } else {
          failedCount++;
          errors.push(`[${source.name}] ${res.error}`);
        }
      });
      await Promise.all(batchPromises);
    }

    return { results, successfulCount, failedCount, errors };
  }
}

export const rssProvider = new RssProvider();

export async function fetchAllSources(sources: NewsSource[], concurrency = 4) {
  return rssProvider.fetchAllFeeds(sources, concurrency);
}
