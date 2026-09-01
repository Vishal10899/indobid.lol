import { prisma } from './db';
import { ADMIN_EMAIL } from './auth';

export const FOUNDER_USERNAMES = ['vishalchaudhary'];
export const FOUNDER_ROLES = ['founder', 'FOUNDER', 'admin', 'ADMIN'];

/**
 * Checks if a given user object or session belongs to the official Founder/Admin
 */
export function isFounder(user: {
  id?: string;
  username?: string | null;
  email?: string | null;
  role?: string | null;
} | null | undefined): boolean {
  if (!user) return false;

  const role = user.role?.toLowerCase()?.trim();
  if (role && (role === 'founder' || role === 'admin')) {
    return true;
  }

  const username = user.username?.toLowerCase()?.trim();
  if (username && FOUNDER_USERNAMES.includes(username)) {
    return true;
  }

  const email = user.email?.toLowerCase()?.trim();
  if (email && email === ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Authoritatively retrieves or provisions the official Founder User account
 */
export async function getOrCreateFounderUser() {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { role: 'founder' },
        { username: 'vishalchaudhary' },
        { email: ADMIN_EMAIL },
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
          username: existing.username || 'vishalchaudhary',
          displayName: existing.displayName || 'Vishal Chaudhary',
        },
      });
    }
    return existing;
  }

  return await prisma.user.create({
    data: {
      username: 'vishalchaudhary',
      displayName: 'Vishal Chaudhary',
      email: ADMIN_EMAIL,
      role: 'founder',
      isVerified: true,
      bio: 'Founder of IndoBid.lol · Back opinions with conviction.',
    },
  });
}
