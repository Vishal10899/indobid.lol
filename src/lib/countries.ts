/**
 * Reusable Country source of truth for Indobid.lol
 * Uses standard ISO 3166-1 alpha-2 country codes.
 */

export interface Country {
  code: string;
  name: string;
  flag: string;
}

/**
 * Computes unicode regional indicator emoji flag from ISO 3166-1 alpha-2 code
 */
export function codeToEmojiFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const code = countryCode.toUpperCase();
  const first = code.charCodeAt(0) - 65 + 0x1f1e6;
  const second = code.charCodeAt(1) - 65 + 0x1f1e6;
  if (first < 0x1f1e6 || first > 0x1f1ff || second < 0x1f1e6 || second > 0x1f1ff) {
    return '🌐';
  }
  return String.fromCodePoint(first, second);
}

// Curated list of popular startup/business countries + all standard international markets
export const POPULAR_COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
];

const COUNTRY_MAP = new Map<string, Country>();
for (const country of POPULAR_COUNTRIES) {
  COUNTRY_MAP.set(country.code.toUpperCase(), country);
}

export const DEFAULT_COUNTRY_CODE = 'IN';

/**
 * Validates whether a country code is a recognized ISO 2-letter code
 */
export function isValidCountryCode(code?: string | null): boolean {
  if (!code || typeof code !== 'string') return false;
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2) return false;
  // Valid if in our map OR standard 2-letter uppercase ISO format
  return /^[A-Z]{2}$/.test(upper);
}

/**
 * Gets the Country object for a given code (or null if not found)
 */
export function getCountry(code?: string | null): Country | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  const known = COUNTRY_MAP.get(upper);
  if (known) return known;
  if (/^[A-Z]{2}$/.test(upper)) {
    return {
      code: upper,
      name: upper,
      flag: codeToEmojiFlag(upper),
    };
  }
  return null;
}

/**
 * Returns the emoji flag for a country code
 */
export function getCountryFlag(code?: string | null): string {
  if (!code) return '🌐';
  const upper = code.trim().toUpperCase();
  const known = COUNTRY_MAP.get(upper);
  if (known) return known.flag;
  return codeToEmojiFlag(upper);
}

/**
 * Returns the country name for a given code (or fallback)
 */
export function getCountryName(code?: string | null): string {
  if (!code) return 'Country not specified';
  const upper = code.trim().toUpperCase();
  const known = COUNTRY_MAP.get(upper);
  if (known) return known.name;
  return upper;
}

/**
 * Formats a clean country label e.g. "🇮🇳 India" or "Country not specified"
 */
export function formatCountryDisplay(code?: string | null): string {
  if (!code) return 'Country not specified';
  const upper = code.trim().toUpperCase();
  const known = COUNTRY_MAP.get(upper);
  if (known) return `${known.flag} ${known.name}`;
  return `${codeToEmojiFlag(upper)} ${upper}`;
}
