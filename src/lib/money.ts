/**
 * IndoBid Money & Currency System (Strict Integer Paise & USD/INR)
 * $2 USD = 200 paise / base units
 * $1 USD = 100 paise / base units
 * Floating-point money calculations are strictly prohibited.
 */

export const MINIMUM_DEBATE_PAISE = 200; // $2 USD base minimum (200 paise)
export const MINIMUM_DEBATE_USD = 2; // $2 USD minimum
export const MINIMUM_INCREMENT_PAISE = 100; // $1 USD step-up (100 paise)
export const CURRENCY = 'INR';
export const DISPLAY_CURRENCY = 'USD';
export const USD_TO_INR_RATE = 85; // Standard 1 USD = 85 INR exchange rate

/**
 * Formats integer paise / cents into a clean USD representation (e.g. $2, $10, $25, $500)
 */
export function formatUSD(paiseOrCents: number): string {
  if (typeof paiseOrCents !== 'number' || isNaN(paiseOrCents) || paiseOrCents <= 0) return '$0';
  
  let dollars = paiseOrCents >= 100 ? Math.floor(paiseOrCents / 100) : paiseOrCents;
  
  // Format with thousands separator
  return `$${dollars.toLocaleString('en-US')}`;
}

/**
 * Formats monetary amounts for clean social UI (defaults to USD display)
 */
export function formatMoney(amount: number): string {
  return formatUSD(amount);
}

/**
 * Formats integer paise into a clean Indian Rupee representation (e.g. ₹10, ₹1,284)
 */
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
 * Rule: nextContribution >= latestVerifiedContribution + ₹1 (100 paise)
 */
export function calculateNextMinimumPaise(latestContributionPaise: number): number {
  if (!latestContributionPaise || latestContributionPaise <= 0) {
    return MINIMUM_DEBATE_PAISE; // Default ₹10 for new or empty debate
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
        error: `Starting a new debate requires a minimum contribution of ${formatINR(MINIMUM_DEBATE_PAISE)}.`,
      };
    }
    return { valid: true, minRequiredPaise: MINIMUM_DEBATE_PAISE };
  }

  const minRequired = calculateNextMinimumPaise(latestVerifiedPaise);
  if (proposedPaise < minRequired) {
    return {
      valid: false,
      minRequiredPaise: minRequired,
      error: `Your contribution must be at least ${formatINR(minRequired)} (previous contribution was ${formatINR(latestVerifiedPaise)}).`,
    };
  }

  return { valid: true, minRequiredPaise: minRequired };
}
