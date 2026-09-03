/**
 * INDOBID — FINANCIAL CONVICTION SIGNAL
 * Applies logarithmic normalization (whale dampening) so 100x money produces ~2.0x score increase.
 */

export const CONVICTION_CONFIG = {
  DIVISOR_PAISE: 1000, // ₹10 base divisor
  WEIGHT: 10,
};

export function calculateConvictionScore(totalVerifiedPaise: number): number {
  if (!totalVerifiedPaise || totalVerifiedPaise <= 0) return 0;
  // Logarithmic scaling caps whale power
  return Math.log10(1 + totalVerifiedPaise / CONVICTION_CONFIG.DIVISOR_PAISE) * CONVICTION_CONFIG.WEIGHT;
}
