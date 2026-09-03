/**
 * INDOBID — FEATURE FLAGS CONFIGURATION
 */

export const featureFlags = {
  enablePaidDebates: true,
  enableFreeDebates: true,
  enableDirectMessages: true,
  enableCreatorPayouts: true,
  enableAuthorDiversity: true,
  enableWhaleDampening: true,
  enableColdStartBoost: true,
  enableActivityDecay: true,
} as const;

export type FeatureFlags = typeof featureFlags;
