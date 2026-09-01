/**
 * IndoBid Money & Currency System (Strict Integer Paise & INR)
 * ₹10 = 1000 paise
 * ₹1 = 100 paise
 * Floating-point money calculations are strictly prohibited.
 */

export const MINIMUM_DEBATE_PAISE = 1000; // ₹10
export const MINIMUM_INCREMENT_PAISE = 100; // ₹1
export const CURRENCY = 'INR';

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
