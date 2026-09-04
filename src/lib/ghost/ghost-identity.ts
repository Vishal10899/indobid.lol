/**
 * INDOBID — GHOST IDENTITY GENERATOR
 * Generates stable, non-reversible, anonymous server-side identities for Ghost Mode.
 * Ensures zero leakage of real user ID, real username, email, phone, or bio.
 */

import { prisma } from '../db';
import { safeDb } from '../../infrastructure/database/transactions';

const GHOST_ADJECTIVES = [
  'Silent',
  'Hidden',
  'Unknown',
  'Quiet',
  'Shadow',
  'Midnight',
  'Ethereal',
  'Phantom',
  'Mystic',
  'Cosmic',
  'Wandering',
  'Secret',
  'Echoing',
  'Velvet',
  'Nebula',
  'Zenith',
  'Cipher',
  'Stealth',
  'Drifting',
  'Astral',
  'Obsidian',
  'Solar',
  'Lunar',
  'Enigmatic',
  'Silver',
];

const GHOST_NOUNS = [
  'Echo',
  'Signal',
  'Voice',
  'Pioneer',
  'Observer',
  'Whisper',
  'Nomad',
  'Seeker',
  'Traveler',
  'Debater',
  'Thinker',
  'Specter',
  'Horizon',
  'Voyager',
  'Current',
  'Spark',
  'Oracle',
  'Riddle',
  'Pulse',
  'Pathfinder',
  'Mirage',
  'Chronicle',
  'Vanguard',
  'Beacon',
  'Sentinel',
];

/**
 * Generates a random, professional ghost display name.
 */
export function generateGhostDisplayName(): string {
  const adj = GHOST_ADJECTIVES[Math.floor(Math.random() * GHOST_ADJECTIVES.length)];
  const noun = GHOST_NOUNS[Math.floor(Math.random() * GHOST_NOUNS.length)];
  return `${adj} ${noun}`;
}

/**
 * Retrieves or establishes a stable ghost display identity for a user.
 * Guarantees that within a Ghost Mode lifecycle, the user's ghost name remains stable.
 */
export async function getOrAssignGhostDisplayName(
  userOrId: string | { id: string; ghostDisplayName?: string | null }
): Promise<string> {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  const existingName = typeof userOrId === 'object' ? userOrId.ghostDisplayName : null;

  if (existingName && existingName.trim().length > 0) {
    return existingName.trim();
  }

  const user = await safeDb(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { ghostDisplayName: true },
    })
  );

  if (user?.ghostDisplayName && user.ghostDisplayName.trim().length > 0) {
    return user.ghostDisplayName.trim();
  }

  const newGhostName = generateGhostDisplayName();
  await safeDb(() =>
    prisma.user.update({
      where: { id: userId },
      data: { ghostDisplayName: newGhostName },
    })
  );

  return newGhostName;
}
