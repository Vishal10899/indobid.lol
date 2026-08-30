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
 * Validates and ensures a string is a valid HTTP/HTTPS URL or bare domain
 * Accepts:
 *   - https://example.com
 *   - http://example.com
 *   - https://www.example.com
 *   - http://www.example.com
 *   - www.example.com
 *   - example.com
 *   - indobid.lol
 *   - bare domain with paths/queries: indobid.lol/product?id=1
 *
 * Rejects:
 *   - javascript:, data:, vbscript:, file:, blob:, about:, mailto:, tel:
 *   - whitespace, control characters
 *   - localhost, 127.0.0.1, internal IP addresses
 *   - missing TLD or invalid domain syntax
 */
export function validateAndFormatUrl(inputUrl: string): { isValid: boolean; formattedUrl: string; error?: string } {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, formattedUrl: '', error: 'URL is required' };
  }

  const trimmed = inputUrl.trim();
  if (trimmed.length === 0) {
    return { isValid: false, formattedUrl: '', error: 'URL cannot be empty' };
  }

  // 1. Block dangerous / unsafe protocols immediately
  if (/^(javascript|data|vbscript|file|blob|about|mailto|tel):/i.test(trimmed)) {
    return { isValid: false, formattedUrl: '', error: 'Unsafe URL protocol is not permitted' };
  }

  // Check for invalid characters like whitespace or control characters
  if (/[\s\r\n\t]/.test(trimmed)) {
    return { isValid: false, formattedUrl: '', error: 'URL cannot contain whitespace' };
  }

  // 2. Normalize protocol: If no protocol or starts with //, prepend https://
  let normalized = trimmed;
  if (/^\/\//.test(normalized)) {
    normalized = `https:${normalized}`;
  } else if (!/^https?:\/\//i.test(normalized)) {
    // If it starts with another protocol like ftp://, reject
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalized)) {
      return { isValid: false, formattedUrl: '', error: 'Only HTTP and HTTPS URLs are supported' };
    }
    normalized = `https://${normalized}`;
  }

  try {
    const parsed = new URL(normalized);

    // Only allow http: and https: protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, formattedUrl: '', error: 'Only HTTP and HTTPS URLs are supported' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block empty hostname
    if (!hostname || hostname.length === 0) {
      return { isValid: false, formattedUrl: '', error: 'Please enter a valid domain name' };
    }

    // Block localhost and internal IP addresses
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

    // Domain validation: Must contain at least one dot (e.g. example.com, indobid.lol)
    if (!hostname.includes('.')) {
      return { isValid: false, formattedUrl: '', error: 'Please enter a valid domain name with an extension (e.g. .com, .lol)' };
    }

    // Validate hostname labels (RFC 1035 / 1123 format)
    const labels = hostname.split('.');
    for (const label of labels) {
      if (!label || label.length === 0 || label.length > 63) {
        return { isValid: false, formattedUrl: '', error: 'Invalid domain format' };
      }
      if (label.startsWith('-') || label.endsWith('-')) {
        return { isValid: false, formattedUrl: '', error: 'Domain labels cannot start or end with a hyphen' };
      }
      if (!/^[a-z0-9-]+$/i.test(label)) {
        return { isValid: false, formattedUrl: '', error: 'Domain contains invalid characters' };
      }
    }

    // Top-Level Domain (TLD) validation: part after last dot must be at least 2 chars and not numeric-only
    const tld = labels[labels.length - 1];
    if (tld.length < 2 || !/^[a-z0-9]+$/i.test(tld) || /^[0-9]+$/.test(tld)) {
      return { isValid: false, formattedUrl: '', error: 'Please enter a valid domain extension (e.g. .com, .lol, .ai)' };
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
