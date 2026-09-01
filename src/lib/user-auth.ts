import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { prisma } from './db';

const AUTH_COOKIE_NAME = 'indobid_session';
const AUTH_SECRET = process.env.AUTH_SECRET || 'indobid_social_jwt_secret_94884210';

export interface UserSession {
  userId: string;
  username: string;
  email: string | null;
  displayName: string;
  role: string;
}

/**
 * Cryptographic password hash with salt using PBKDF2
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Signs a session payload into a secure HMAC-signed token
 */
export function createSessionToken(payload: UserSession): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): UserSession | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieve current logged-in user from request cookies or Next.js headers
 */
export async function getCurrentUser(request?: NextRequest | Request): Promise<UserSession | null> {
  try {
    let token: string | undefined;

    if (request && 'cookies' in request && typeof (request as any).cookies?.get === 'function') {
      token = (request as any).cookies.get(AUTH_COOKIE_NAME)?.value;
    }

    if (!token && request) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      try {
        const cookieStore = await cookies();
        token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      } catch {}
    }

    if (!token) return null;

    const session = verifySessionToken(token);
    if (!session) return null;

    // Verify user still exists and is not suspended in database
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, email: true, displayName: true, role: true, isSuspended: true },
    });

    if (!dbUser || dbUser.isSuspended) {
      return null;
    }

    return {
      userId: dbUser.id,
      username: dbUser.username || 'user',
      email: dbUser.email,
      displayName: dbUser.displayName || dbUser.username || 'Debater',
      role: dbUser.role,
    };
  } catch {
    return null;
  }
}

export { AUTH_COOKIE_NAME };
