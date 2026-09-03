/**
 * INDOBID — COUNTRY TO CURRENCY MAPPING
 * Canonical ISO country code mapping to official default currency.
 */

import { BASE_CURRENCY } from './currencies';

export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  flag: string;
}

export const COUNTRY_CURRENCY: Record<string, string> = {
  IN: 'INR', // India 🇮🇳
  US: 'USD', // United States 🇺🇸
  GB: 'GBP', // United Kingdom 🇬🇧
  DE: 'EUR', // Germany 🇩🇪
  CA: 'CAD', // Canada 🇨🇦
  AU: 'AUD', // Australia 🇦🇺
  FR: 'EUR', // France 🇫🇷
  IT: 'EUR', // Italy 🇮🇹
  ES: 'EUR', // Spain 🇪🇸
  NL: 'EUR', // Netherlands 🇳🇱
  JP: 'JPY', // Japan 🇯🇵
  SG: 'SGD', // Singapore 🇸🇬
  AE: 'AED', // United Arab Emirates 🇦🇪
  CH: 'CHF', // Switzerland 🇨🇭
  NZ: 'NZD', // New Zealand 🇳🇿
  BR: 'BRL', // Brazil 🇧🇷
  MX: 'MXN', // Mexico 🇲🇽
  ZA: 'ZAR', // South Africa 🇿🇦
};

export const COUNTRIES: CountryInfo[] = [
  { code: 'IN', name: 'India', currency: 'INR', flag: '🇮🇳' },
  { code: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', currency: 'EUR', flag: '🇩🇪' },
  { code: 'CA', name: 'Canada', currency: 'CAD', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', currency: 'AUD', flag: '🇦🇺' },
  { code: 'FR', name: 'France', currency: 'EUR', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', currency: 'EUR', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', currency: 'EUR', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', flag: '🇳🇱' },
  { code: 'JP', name: 'Japan', currency: 'JPY', flag: '🇯🇵' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', flag: '🇸🇬' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪' },
];

export const DEFAULT_COUNTRY = 'IN';

/**
 * Resolves the official currency for an ISO country code.
 * Defaults to BASE_CURRENCY (INR) if country is unrecognized.
 */
export function getCurrencyForCountry(countryCode?: string | null): string {
  if (!countryCode || typeof countryCode !== 'string') {
    return BASE_CURRENCY;
  }
  const normalized = countryCode.toUpperCase().trim();
  return COUNTRY_CURRENCY[normalized] || BASE_CURRENCY;
}

/**
 * Validates whether a country code is an accepted ISO 3166-1 alpha-2 code.
 */
export function isValidCountryCode(countryCode?: string | null): boolean {
  if (!countryCode || typeof countryCode !== 'string') {
    return false;
  }
  return Boolean(COUNTRY_CURRENCY[countryCode.toUpperCase().trim()]);
}

/**
 * Returns the list of supported countries with display names and flags.
 */
export function getSupportedCountries(): CountryInfo[] {
  return [...COUNTRIES];
}
