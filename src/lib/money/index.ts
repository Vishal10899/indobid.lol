/**
 * INDOBID — MONEY & CURRENCY CONVERSION AGGREGATOR
 * Combines global country/currency architecture with backward-compatible primitives.
 */

export * from './currencies';
export * from './country-currency';
export * from './exchange-rate';
export * from './minimum-support';
export * from './money';

// Legacy compatibility exports (Preserving existing test invariants)
export const MINIMUM_DEBATE_PAISE = 200; // $2 USD base minimum (200 paise / cents)
export const MINIMUM_DEBATE_USD = 2; // $2 USD minimum
export const MINIMUM_INCREMENT_PAISE = 100; // $1 USD step-up (100 paise / cents)
export const CURRENCY = 'INR';
export const DISPLAY_CURRENCY = 'USD';
export const USD_TO_INR_RATE = 85;

/**
 * Converts integer paise to integer rupees (floored)
 */
export function paiseToRupees(paise: number): number {
  return Math.floor(paise / 100);
}

/**
 * Converts rupees to integer paise
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Calculates authoritative minimum allowed contribution for continuing a debate
 */
export function calculateNextMinimumPaise(latestContributionPaise?: number | null): number {
  if (!latestContributionPaise || latestContributionPaise <= 0) {
    return MINIMUM_DEBATE_PAISE;
  }
  return latestContributionPaise + MINIMUM_INCREMENT_PAISE;
}

/**
 * Validates whether a proposed contribution meets minimum requirement
 */
export function isValidContributionAmount(
  proposedPaise: number,
  latestVerifiedPaise: number,
  isNewDebate: boolean = false
): { valid: boolean; minRequiredPaise: number; error?: string } {
  if (isNewDebate) {
    if (proposedPaise < MINIMUM_DEBATE_PAISE) {
      return {
        valid: false,
        minRequiredPaise: MINIMUM_DEBATE_PAISE,
        error: `Starting a new debate requires a minimum contribution of ₹${MINIMUM_DEBATE_PAISE / 100}.`,
      };
    }
    return { valid: true, minRequiredPaise: MINIMUM_DEBATE_PAISE };
  }

  const minRequired = calculateNextMinimumPaise(latestVerifiedPaise);
  if (proposedPaise < minRequired) {
    return {
      valid: false,
      minRequiredPaise: minRequired,
      error: `Your contribution must be at least ₹${minRequired / 100} (previous contribution was ₹${latestVerifiedPaise / 100}).`,
    };
  }

  return { valid: true, minRequiredPaise: minRequired };
}
