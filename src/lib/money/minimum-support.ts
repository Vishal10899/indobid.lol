/**
 * INDOBID — MINIMUM SUPPORT & LOCALIZED PRESETS
 * Enforces canonical BASE_MINIMUM_SUPPORT = ₹10 INR worldwide.
 * Derives local currency minimums and presets from base INR.
 */

import { BASE_CURRENCY, BASE_MINIMUM_SUPPORT, BASE_MINIMUM_SUPPORT_PAISE, getCurrencyConfig } from './currencies';
import { exchangeRateService } from './exchange-rate';

export interface MinimumSupportDetails {
  baseAmountPaise: number;       // Canonical 1000 paise (₹10 INR)
  baseCurrency: string;          // "INR"
  currency: string;              // Target currency e.g. "USD", "EUR", "GBP"
  minimumMinorUnits: number;     // e.g. 1000 paise, 12 cents ($0.12), 10 pence (£0.10)
  formatted: string;             // Display string e.g. "₹10", "$0.12"
}

export interface LocalizedPreset {
  baseInr: number;               // Base Rupee amount (₹10, ₹20, ₹50, etc.)
  basePaise: number;             // Base Paise amount (1000, 2000, 5000, etc.)
  targetMinorUnits: number;      // Converted minor units in target currency
  currency: string;
  label: string;                 // Display label e.g. "₹10" or "$0.12"
}

// Canonical Base INR Presets: ₹10, ₹20, ₹50, ₹100, ₹250, ₹500
export const BASE_INR_PRESETS = [10, 20, 50, 100, 250, 500];

/**
 * Calculates the authoritative minimum support required in any currency,
 * derived from the canonical ₹10 INR base floor.
 */
export function getMinimumSupport(currencyCode: string = BASE_CURRENCY): MinimumSupportDetails {
  const currency = (currencyCode || BASE_CURRENCY).toUpperCase().trim();
  const minimumMinorUnits = exchangeRateService.convertFromBase(BASE_MINIMUM_SUPPORT_PAISE, currency);
  const formatted = formatCurrencyAmount(minimumMinorUnits, currency);

  return {
    baseAmountPaise: BASE_MINIMUM_SUPPORT_PAISE,
    baseCurrency: BASE_CURRENCY,
    currency,
    minimumMinorUnits,
    formatted,
  };
}

/**
 * Validates whether a payment amount meets the required canonical ₹10 equivalent floor.
 */
export function validateSupportAmount(
  amountInMinorUnits: number,
  currencyCode: string = BASE_CURRENCY
): { valid: boolean; minRequired: number; error?: string } {
  const minDetails = getMinimumSupport(currencyCode);

  if (typeof amountInMinorUnits !== 'number' || isNaN(amountInMinorUnits) || amountInMinorUnits < minDetails.minimumMinorUnits) {
    return {
      valid: false,
      minRequired: minDetails.minimumMinorUnits,
      error: `Minimum support is ${minDetails.formatted} (equivalent to ₹${BASE_MINIMUM_SUPPORT} ${BASE_CURRENCY}).`,
    };
  }

  return { valid: true, minRequired: minDetails.minimumMinorUnits };
}

/**
 * Generates localized payment presets for the UI from base INR values.
 */
export function getLocalizedPresets(currencyCode: string = BASE_CURRENCY): LocalizedPreset[] {
  const currency = (currencyCode || BASE_CURRENCY).toUpperCase().trim();

  return BASE_INR_PRESETS.map((baseInr) => {
    const basePaise = baseInr * 100;
    const targetMinorUnits = exchangeRateService.convertFromBase(basePaise, currency);
    return {
      baseInr,
      basePaise,
      targetMinorUnits,
      currency,
      label: formatCurrencyAmount(targetMinorUnits, currency),
    };
  });
}

/**
 * Formats minor units into clean localized currency representation.
 */
export function formatCurrencyAmount(minorUnits: number, currencyCode: string = BASE_CURRENCY): string {
  if (typeof minorUnits !== 'number' || isNaN(minorUnits)) return '0';
  const config = getCurrencyConfig(currencyCode);

  const major = minorUnits / Math.pow(10, config.decimals);
  if (config.decimals === 0) {
    return `${config.symbol}${major.toLocaleString('en-US')}`;
  }

  // If fractional part is 0, format cleanly as integer (e.g. ₹10 instead of ₹10.00)
  if (minorUnits % Math.pow(10, config.decimals) === 0) {
    return `${config.symbol}${major.toLocaleString('en-US')}`;
  }

  return `${config.symbol}${major.toLocaleString('en-US', {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  })}`;
}
