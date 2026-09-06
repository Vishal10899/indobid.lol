/**
 * INDOBID DAILY — NORMALIZER
 * Normalizes URLs, titles, descriptions, and extracts normalized keywords
 * for deduplication and clustering.
 */

const COMMON_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'arent', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'can', 'cannot', 'could', 'couldn', 'did', 'didn', 'do', 'does', 'doesn', 'doing', 'don',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn', 'has', 'hasn', 'have',
  'haven', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i',
  'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'just', 'll', 'm', 'ma', 'me', 'mightn',
  'more', 'most', 'mustn', 'my', 'myself', 'needn', 'no', 'nor', 'not', 'now', 'o', 'of', 'off',
  'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 're', 's',
  'same', 'shan', 'she', 'should', 'shouldn', 'so', 'some', 'such', 't', 'than', 'that', 'the',
  'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'too', 'under', 'until', 'up', 've', 'very', 'was', 'wasn', 'we', 'were', 'weren', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'won', 'would', 'wouldn',
  'y', 'you', 'your', 'yours', 'yourself', 'yourselves',
  // News headline noise words
  'says', 'said', 'saying', 'new', 'latest', 'live', 'update', 'updates', 'report', 'reports', 'reported',
  'breaking', 'watch', 'video', 'photos', 'exclusive', 'analysis', 'explainer', 'opinion', 'briefing',
]);

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gclsrc',
  'ref',
  'ref_src',
  'ref_url',
  'source',
  'ncid',
  'ocid',
  'guccounter',
  'guce_referrer',
  'guce_referrer_usqp',
  'ved',
  'from',
]);

/**
 * Decodes HTML entities from a string
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '—')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

/**
 * Cleans and strips tracking parameters and hash from an article URL
 */
export function cleanArticleUrl(urlStr: string): string {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr.trim());
    parsed.hash = '';

    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    let cleaned = parsed.toString();
    // Remove trailing slash if path is not root
    if (cleaned.endsWith('/') && parsed.pathname !== '/') {
      cleaned = cleaned.slice(0, -1);
    }
    return cleaned;
  } catch {
    // If invalid URL, strip hash and query if possible
    return urlStr.split('#')[0].trim();
  }
}

/**
 * Cleans and normalizes news article titles:
 * - Decodes HTML entities
 * - Strips common publisher suffixes (e.g., "- BBC News", "| Reuters")
 * - Collapses whitespace and trims
 */
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let cleaned = decodeHtmlEntities(rawTitle).trim();

  // Strip common trailing publisher tag
  cleaned = cleaned.replace(/\s*[-|–—:]\s*(BBC News|BBC|Reuters|The Hindu|The Indian Express|Mint|NDTV|Business Standard|TechCrunch|The Verge|Ars Technica|Wired|CNBC|CNN|Bloomberg|AP News|Al Jazeera|Hacker News|The Guardian|Forbes|Fortune|MarketWatch|CoinDesk|The Register|9to5Mac|Engadget)\s*$/i, '');

  // Strip trailing " - [Publisher]" if matches generic word with dash
  cleaned = cleaned.replace(/\s+[-|–—]\s+[A-Za-z0-9\s.]{2,25}$/, '');

  // Strip bracketed prefixes/suffixes like [Live], [Watch], (Video), [Breaking]
  cleaned = cleaned.replace(/^\[(Live|Breaking|Watch|Update|Exclusive|Photos?)\]\s*/i, '');
  cleaned = cleaned.replace(/\s*\[(Live|Breaking|Watch|Update|Exclusive|Photos?)\]$/i, '');
  cleaned = cleaned.replace(/^\((Live|Breaking|Watch|Update|Exclusive|Photos?)\)\s*/i, '');
  cleaned = cleaned.replace(/\s*\((Live|Breaking|Watch|Update|Exclusive|Photos?)\)$/i, '');

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Cleans HTML or markup from description text
 */
export function cleanDescription(rawDesc?: string): string {
  if (!rawDesc) return '';
  let text = decodeHtmlEntities(rawDesc);
  // Strip HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  // Remove markdown links or urls
  text = text.replace(/https?:\/\/[^\s]+/g, '');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Extracts normalized tokens/keywords from title (and optionally description)
 */
export function extractKeywords(title: string, description?: string): string[] {
  const combined = `${title} ${description || ''}`.toLowerCase();
  // Strip punctuation and special characters
  const sanitized = combined.replace(/[^a-z0-9\s]/g, ' ');
  const words = sanitized.split(/\s+/).filter(w => w.length >= 3 && !COMMON_STOPWORDS.has(w));

  // Deduplicate and sort
  const unique = Array.from(new Set(words));
  return unique.sort();
}
