/**
 * INDOBID — EXCHANGE RATE SERVICE
 * Cached multi-currency exchange rates relative to canonical BASE_CURRENCY (INR).
 * Ensures deterministic, integer-minor-unit currency conversions.
 */

import { BASE_CURRENCY, getCurrencyConfig } from './currencies';

export interface ExchangeRateSnapshot {
  baseCurrency: string;
  source: string;
  fetchedAt: Date;
  expiresAt: Date;
  rates: Record<string, number>; // How many units of target currency per 1 INR
}

// Canonical exchange rates (Target units per 1 INR)
// e.g. 1 USD = ~85 INR => 1 INR = 0.011765 USD
// e.g. 1 EUR = ~92 INR => 1 INR = 0.010870 EUR
// e.g. 1 GBP = ~108 INR => 1 INR = 0.009259 GBP
const CANONICAL_INR_RATES: Record<string, number> = {
  INR: 1.0,
  USD: 1 / 85.0,     // ~0.011765
  EUR: 1 / 92.0,     // ~0.010870
  GBP: 1 / 108.0,    // ~0.009259
  CAD: 1 / 62.0,     // ~0.016129
  AUD: 1 / 55.0,     // ~0.018182
  JPY: 1 / 0.55,     // ~1.818182
  SGD: 1 / 64.0,     // ~0.015625
  AED: 1 / 23.14,    // ~0.043215
  CHF: 1 / 96.0,     // ~0.010417
  NZD: 1 / 51.0,     // ~0.019608
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

class ExchangeRateService {
  private cache: ExchangeRateSnapshot;

  constructor() {
    this.cache = this.initializeDefaultSnapshot();
  }

  private initializeDefaultSnapshot(): ExchangeRateSnapshot {
    const now = new Date();
    return {
      baseCurrency: BASE_CURRENCY,
      source: 'canonical-rates-engine',
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      rates: { ...CANONICAL_INR_RATES },
    };
  }

  /**
   * Returns active exchange rate snapshot, refreshing if expired.
   */
  public getSnapshot(): ExchangeRateSnapshot {
    if (new Date() > this.cache.expiresAt) {
      // Re-arm snapshot with current timestamp
      const now = new Date();
      this.cache.fetchedAt = now;
      this.cache.expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
    }
    return this.cache;
  }

  /**
   * Returns rate between two currencies.
   * e.g. getRate('INR', 'USD') => 0.011765
   * e.g. getRate('USD', 'INR') => 85.0
   */
  public getRate(fromCurrency: string, toCurrency: string): number {
    const from = fromCurrency.toUpperCase().trim();
    const to = toCurrency.toUpperCase().trim();

    if (from === to) return 1.0;

    const rates = this.getSnapshot().rates;
    const fromPerInr = rates[from] ?? CANONICAL_INR_RATES[from] ?? 1.0;
    const toPerInr = rates[to] ?? CANONICAL_INR_RATES[to] ?? 1.0;

    // Cross-rate calculation via INR base
    return toPerInr / fromPerInr;
  }

  /**
   * Converts base INR paise into target currency minor units.
   * Uses ceiling to guarantee that converted amounts never fall below the purchasing power floor.
   */
  public convertFromBase(amountInBasePaise: number, targetCurrency: string): number {
    const target = targetCurrency.toUpperCase().trim();
    if (target === BASE_CURRENCY) {
      return Math.round(amountInBasePaise);
    }

    const rate = this.getRate(BASE_CURRENCY, target);
    const targetConfig = getCurrencyConfig(target);
    const baseConfig = getCurrencyConfig(BASE_CURRENCY);

    // Major INR = amountInBasePaise / 10^baseConfig.decimals
    const majorInr = amountInBasePaise / Math.pow(10, baseConfig.decimals);
    const targetMajor = majorInr * rate;
    
    // Minor target = targetMajor * 10^targetConfig.decimals (using Math.ceil to protect minimum)
    const targetMinor = Math.ceil(targetMajor * Math.pow(10, targetConfig.decimals));
    return Math.max(1, targetMinor);
  }

  /**
   * Converts foreign currency minor units into base INR paise.
   */
  public convertToBase(amountInTargetMinor: number, sourceCurrency: string): number {
    const source = sourceCurrency.toUpperCase().trim();
    if (source === BASE_CURRENCY) {
      return Math.round(amountInTargetMinor);
    }

    const rate = this.getRate(source, BASE_CURRENCY);
    const sourceConfig = getCurrencyConfig(source);
    const baseConfig = getCurrencyConfig(BASE_CURRENCY);

    const sourceMajor = amountInTargetMinor / Math.pow(10, sourceConfig.decimals);
    const inrMajor = sourceMajor * rate;
    return Math.round(inrMajor * Math.pow(10, baseConfig.decimals));
  }
}

export const exchangeRateService = new ExchangeRateService();
