/**
 * INDOBID — GLOBAL CURRENCIES SPECIFICATION
 * Centralized definition of supported currencies, minor units, symbols, and base currency rules.
 */

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  minorUnit: string; // e.g. "paise", "cents", "pence"
  decimals: number;  // number of decimal places for minor unit (2 for USD/INR/EUR, 0 for JPY)
}

export const BASE_CURRENCY = 'INR';
export const BASE_MINIMUM_SUPPORT = 10; // ₹10 INR canonical minimum support
export const BASE_MINIMUM_SUPPORT_PAISE = 1000; // 1000 paise = ₹10 INR

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    minorUnit: 'paise',
    decimals: 2,
  },
  USD: {
    code: 'USD',
    name: 'United States Dollar',
    symbol: '$',
    minorUnit: 'cents',
    decimals: 2,
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    minorUnit: 'pence',
    decimals: 2,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    minorUnit: 'cents',
    decimals: 2,
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    minorUnit: 'cents',
    decimals: 2,
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    minorUnit: 'cents',
    decimals: 2,
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    minorUnit: 'yen',
    decimals: 0,
  },
  SGD: {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'S$',
    minorUnit: 'cents',
    decimals: 2,
  },
  AED: {
    code: 'AED',
    name: 'United Arab Emirates Dirham',
    symbol: 'AED',
    minorUnit: 'fils',
    decimals: 2,
  },
};

export function getCurrencyConfig(currencyCode: string): CurrencyConfig {
  const upper = (currencyCode || BASE_CURRENCY).toUpperCase().trim();
  return SUPPORTED_CURRENCIES[upper] || SUPPORTED_CURRENCIES[BASE_CURRENCY];
}

export function isSupportedCurrency(currencyCode: string): boolean {
  if (!currencyCode || typeof currencyCode !== 'string') return false;
  return Boolean(SUPPORTED_CURRENCIES[currencyCode.toUpperCase().trim()]);
}
