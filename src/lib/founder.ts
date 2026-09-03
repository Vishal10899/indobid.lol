import { prisma } from './db';
import { ADMIN_EMAIL, normalizeEmail } from './auth';

export const FOUNDER_ROLES = ['founder', 'FOUNDER', 'admin', 'ADMIN'];

/**
 * Checks if a given user object or session belongs to the official Founder/Admin.
 * Must be determined strictly server-side by checking against ADMIN_EMAIL or server-authenticated 'founder'/'admin' role.
 * Never trusts client-supplied spoofing.
 */
export function isFounder(user: {
  id?: string;
  username?: string | null;
  email?: string | null;
  role?: string | null;
} | null | undefined): boolean {
  if (!user) return false;

  const role = user.role?.toLowerCase()?.trim();
  if (role === 'founder' || role === 'admin') {
    return true;
  }

  const cleanEmail = normalizeEmail(user.email);
  if (cleanEmail && cleanEmail === ADMIN_EMAIL) {
    return true;
  }

  return false;
}

/**
 * Authoritatively retrieves or provisions the official Founder User account based on ADMIN_EMAIL
 */
export async function getOrCreateFounderUser() {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: ADMIN_EMAIL, mode: 'insensitive' } },
        { role: 'founder' },
      ],
    },
  });

  if (existing) {
    const needUpdate =
      existing.role !== 'founder' ||
      !existing.isVerified ||
      !existing.username ||
      !existing.displayName;

    if (needUpdate) {
      return await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'founder',
          isVerified: true,
          username: existing.username || 'vishalkumar',
          displayName: existing.displayName || 'Vishal Kumar',
        },
      });
    }
    return existing;
  }

  return await prisma.user.create({
    data: {
      username: 'vishalkumar',
      displayName: 'Vishal Kumar',
      email: ADMIN_EMAIL,
      role: 'founder',
      isVerified: true,
      bio: 'Founder of IndoBid · Back opinions with conviction.',
    },
  });
}
