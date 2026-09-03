/**
 * INDOBID — AUTHORIZATION & SECURITY POLICIES
 * Server-authoritative access control. Never trusts client-supplied role/isFounder/isAdmin claims.
 */

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { sessionService, UserSession, ADMIN_SESSION_COOKIE } from './session.service';
import { env } from '../../config/env';
import { AuthenticationError, AuthorizationError } from '../../lib/errors';

export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export const ADMIN_EMAIL = env.ADMIN_EMAIL;
export const ADMIN_EMAILS = [ADMIN_EMAIL];
export const ADMIN_SECRET_KEY = env.ADMIN_SECRET_KEY;
export const FOUNDER_ROLES = ['founder', 'FOUNDER', 'admin', 'ADMIN'];

// In-memory rate limiting for admin login attempts
interface FailedAttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil: number;
}
const loginAttempts = new Map<string, FailedAttemptRecord>();

export function checkAdminLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (record.blockedUntil > now) {
      const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
      return { allowed: false, retryAfterSeconds: retryAfter };
    }
    if (now - record.firstAttempt > 15 * 60 * 1000) {
      loginAttempts.delete(ip);
    }
  }

  return { allowed: true };
}

export function recordFailedAdminLogin(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: 0 };
  record.count += 1;

  if (record.count >= 5) {
    record.blockedUntil = now + 15 * 60 * 1000;
  }
  loginAttempts.set(ip, record);
}

export function clearAdminLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Checks if a given user object or session belongs to the official Founder/Admin.
 * Must be determined strictly server-side by checking against ADMIN_EMAIL or server role.
 */
export function isFounder(
  user: {
    id?: string;
    username?: string | null;
    email?: string | null;
    role?: string | null;
  } | null | undefined
): boolean {
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
 * Checks whether an incoming request has valid Admin authorization via cookie, header, or Founder session.
 */
export function isAuthorizedAdmin(request: NextRequest | Request): boolean {
  try {
    const secret = (process.env.ADMIN_SECRET_KEY || ADMIN_SECRET_KEY || '').trim();

    // 1. Authorization header: "Bearer <token>" or "Bearer <secret>"
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        if (
          secret &&
          token.length === secret.length &&
          crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
        ) {
          return true;
        }
        const verification = sessionService.verifyAdminSessionToken(token);
        if (verification.valid) {
          return true;
        }
      }
    }

    // 2. Custom X-Admin-Secret or X-Admin-Key Header
    const secretHeader =
      request.headers.get('x-admin-secret') || request.headers.get('x-admin-key');
    if (secretHeader && secret) {
      const trimmed = secretHeader.trim();
      if (
        trimmed.length === secret.length &&
        crypto.timingSafeEqual(Buffer.from(trimmed), Buffer.from(secret))
      ) {
        return true;
      }
    }

    // 3. Admin session cookie
    let adminCookieToken: string | undefined;
    if ('cookies' in request && typeof (request as any).cookies?.get === 'function') {
      adminCookieToken = (request as any).cookies.get(ADMIN_SESSION_COOKIE)?.value;
    }

    if (!adminCookieToken) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_SESSION_COOKIE}=([^;]+)`));
      if (match) {
        adminCookieToken = decodeURIComponent(match[1]);
      }
    }

    if (adminCookieToken) {
      const verification = sessionService.verifyAdminSessionToken(adminCookieToken);
      if (verification.valid) {
        return true;
      }
    }

    // 4. Authenticated Founder User Session
    let userCookieToken: string | undefined;
    if ('cookies' in request && typeof (request as any).cookies?.get === 'function') {
      userCookieToken = (request as any).cookies.get('indobid_session')?.value;
    }

    if (!userCookieToken) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/(?:^|;\s*)indobid_session=([^;]+)/);
      if (match) {
        userCookieToken = decodeURIComponent(match[1]);
      }
    }

    if (userCookieToken) {
      const userSession = sessionService.verifySessionToken(userCookieToken);
      if (userSession && isFounder(userSession)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Authoritatively retrieves or provisions the official Founder User account based on ADMIN_EMAIL
 */
export async function getOrCreateFounderUser() {
  const existingByEmail = await userRepository.findByEmail(ADMIN_EMAIL);
  if (existingByEmail) {
    if (existingByEmail.role !== 'founder' || !existingByEmail.isVerified) {
      return userRepository.update(existingByEmail.id, {
        role: 'founder',
        isVerified: true,
        displayName: existingByEmail.displayName || 'Vishal Kumar',
        username: existingByEmail.username || 'vishalkumar',
      });
    }
    return existingByEmail;
  }

  // Create official Founder account
  return userRepository.create({
    username: 'vishalkumar',
    displayName: 'Vishal Kumar',
    email: ADMIN_EMAIL,
    role: 'founder',
    isVerified: true,
    bio: 'Founder of IndoBid · Back opinions with conviction.',
  });
}

/**
 * Centralized Guard: Requires authenticated user session
 */
export async function requireAuth(request?: NextRequest | Request): Promise<UserSession> {
  const user = await sessionService.getCurrentUser(request);
  if (!user) {
    throw new AuthenticationError('Authentication required to access this resource');
  }
  return user;
}

/**
 * Centralized Guard: Requires authoritative Founder session
 */
export async function requireFounder(request?: NextRequest | Request): Promise<UserSession> {
  const user = await requireAuth(request);
  if (!isFounder(user)) {
    throw new AuthorizationError('Only the verified Founder can perform this operation');
  }
  return user;
}

/**
 * Centralized Guard: Requires authorized Admin privileges
 */
export function requireAdmin(request: NextRequest | Request): void {
  if (!isAuthorizedAdmin(request)) {
    throw new AuthorizationError('Admin credentials required');
  }
}
