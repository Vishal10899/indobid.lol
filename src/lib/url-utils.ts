export type DestinationType = 'website' | 'instagram' | 'youtube' | 'x' | 'other';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'ref',
  'ref_src',
  'fbclid',
  'gclid',
  'twclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'si',
]);

/**
 * Validates and ensures a string is a valid HTTP/HTTPS URL
 */
export function validateAndFormatUrl(inputUrl: string): { isValid: boolean; formattedUrl: string; error?: string } {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, formattedUrl: '', error: 'URL is required' };
  }

  let cleaned = inputUrl.trim();
  if (cleaned.length === 0) {
    return { isValid: false, formattedUrl: '', error: 'URL cannot be empty' };
  }

  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const parsed = new URL(cleaned);

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, formattedUrl: '', error: 'Only HTTP and HTTPS URLs are supported' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block invalid/internal hostnames
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return { isValid: false, formattedUrl: '', error: 'Internal and localhost addresses are not permitted' };
    }

    if (!hostname.includes('.')) {
      return { isValid: false, formattedUrl: '', error: 'Please enter a valid domain name' };
    }

    return { isValid: true, formattedUrl: parsed.toString() };
  } catch {
    return { isValid: false, formattedUrl: '', error: 'Invalid URL format' };
  }
}

/**
 * Detects destination platform type based on URL hostname and path
 */
export function detectDestinationType(urlStr: string): DestinationType {
  try {
    let formatted = urlStr.trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    const url = new URL(formatted);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'x.com' || host === 'twitter.com') {
      return 'x';
    }
    if (host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com') {
      return 'youtube';
    }
    if (host === 'instagram.com' || host === 'instagr.am') {
      return 'instagram';
    }
    if (
      host === 'github.com' ||
      host === 'linkedin.com' ||
      host === 'tiktok.com' ||
      host === 'facebook.com' ||
      host === 'threads.net' ||
      host === 'reddit.com'
    ) {
      return 'other';
    }
    return 'website';
  } catch {
    return 'other';
  }
}

/**
 * Normalizes a URL to create a canonical key:
 * - Lowercase hostname
 * - Strips common UTM and tracking parameters
 * - Strips standard ports (:80, :443)
 * - Strips hash/fragments
 * - Strips trailing slash
 * - Removes leading www. for consistency
 */
export function normalizeCanonicalUrl(inputUrl: string): string {
  const { isValid, formattedUrl } = validateAndFormatUrl(inputUrl);
  if (!isValid) {
    throw new Error('Cannot normalize invalid URL');
  }

  const url = new URL(formattedUrl);
  
  // Lowercase hostname and remove www.
  let host = url.hostname.toLowerCase();
  if (host.startsWith('www.')) {
    host = host.substring(4);
  }

  // Filter out tracking query parameters
  const searchParams = new URLSearchParams();
  url.searchParams.forEach((val, key) => {
    const lowerKey = key.toLowerCase();
    if (!TRACKING_PARAMS.has(lowerKey) && !lowerKey.startsWith('utm_')) {
      searchParams.append(key, val);
    }
  });

  // Clean pathname (remove trailing slashes, ensure standard leading slash)
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }
  if (pathname === '/') {
    pathname = '';
  }

  // Construct canonical string (e.g. "x.com/indobid" or "indobid.lol/product")
  const queryString = searchParams.toString();
  const canonical = `${host}${pathname}${queryString ? `?${queryString}` : ''}`;

  return canonical.toLowerCase();
}

/**
 * Simple HTML text sanitizer to prevent script injection / XSS
 */
export function sanitizeText(text: string, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[&<>"']/g, (m) => {
      switch (m) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return m;
      }
    })
    .trim()
    .slice(0, maxLength);
}
