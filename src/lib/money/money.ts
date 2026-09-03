/**
 * INDOBID — MONEY FORMATTING & CONVERSION UTILITIES
 * Pure integer arithmetic for multi-currency representations.
 */

import { getCurrencyConfig, BASE_CURRENCY } from './currencies';
import { formatCurrencyAmount } from './minimum-support';

export { formatCurrencyAmount };

export function formatUSD(paiseOrCents: number): string {
  if (typeof paiseOrCents !== 'number' || isNaN(paiseOrCents) || paiseOrCents <= 0) return '$0';
  const dollars = paiseOrCents >= 100 ? Math.floor(paiseOrCents / 100) : paiseOrCents;
  return `$${dollars.toLocaleString('en-US')}`;
}

export function formatINR(paise: number): string {
  if (typeof paise !== 'number' || isNaN(paise)) return '₹0';
  const rupees = Math.floor(paise / 100);
  const remainingPaise = paise % 100;
  const formattedRupees = rupees.toLocaleString('en-IN');
  if (remainingPaise > 0) {
    return `₹${formattedRupees}.${remainingPaise.toString().padStart(2, '0')}`;
  }
  return `₹${formattedRupees}`;
}

export function formatMoney(amountMinor: number, currency: string = 'USD'): string {
  if (currency.toUpperCase() === 'INR') {
    return formatINR(amountMinor);
  }
  if (currency.toUpperCase() === 'USD') {
    return formatUSD(amountMinor);
  }
  return formatCurrencyAmount(amountMinor, currency);
}

export function toMinorUnits(majorUnits: number, currency: string = BASE_CURRENCY): number {
  const config = getCurrencyConfig(currency);
  return Math.round(majorUnits * Math.pow(10, config.decimals));
}

export function toMajorUnits(minorUnits: number, currency: string = BASE_CURRENCY): number {
  const config = getCurrencyConfig(currency);
  return minorUnits / Math.pow(10, config.decimals);
}
