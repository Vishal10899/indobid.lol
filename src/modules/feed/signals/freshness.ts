/**
 * INDOBID — FRESHNESS & TIME DECAY SIGNAL
 * Allocates initial discovery boost and calculates exponential half-life time decay.
 */

export const FRESHNESS_CONFIG = {
  WINDOW_HOURS: 36,
  MAX_BOOST: 35,
  HALF_LIFE_HOURS: 48,
};

export function calculateFreshnessBoost(ageHours: number): number {
  if (ageHours < FRESHNESS_CONFIG.WINDOW_HOURS) {
    const freshnessFactor = 1 - ageHours / FRESHNESS_CONFIG.WINDOW_HOURS;
    return freshnessFactor * FRESHNESS_CONFIG.MAX_BOOST;
  }
  return 0;
}

export function calculateRecencyDecay(inactivityHours: number): number {
  // Exponential half-life decay
  return Math.exp((-1 * inactivityHours) / FRESHNESS_CONFIG.HALF_LIFE_HOURS);
}
