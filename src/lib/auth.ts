import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { verifySessionToken } from './user-auth';

/**
 * Authoritative Email Normalization
 * Standardizes email addresses by trimming leading/trailing whitespace and converting to lowercase.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || 'vishalkumar75912@gmail.com');
export const ADMIN_EMAILS = [ADMIN_EMAIL];
export const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY?.trim() || '';

export const ADMIN_SESSION_COOKIE = 'indobid_admin_session';
const SESSION_MAX_AGE_SECONDS = 86400; // 24 hours

// In-memory rate limiting for admin login attempts (per IP)
interface FailedAttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil: number;
}
const loginAttempts = new Map<string, FailedAttemptRecord>();

/**
 * Checks and records rate limits on admin login attempts
 */
export function checkAdminLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (record.blockedUntil > now) {
      const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
      return { allowed: false, retryAfterSeconds: retryAfter };
    }
    // Reset if window (15 mins) has expired
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
    record.blockedUntil = now + 15 * 60 * 1000; // Block for 15 minutes
  }
  loginAttempts.set(ip, record);
}

export function clearAdminLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Generates an HMAC-SHA256 signed session token for verified admin
 */
export function createAdminSessionToken(email: string): string {
  const secret = (process.env.ADMIN_SECRET_KEY || ADMIN_SECRET_KEY || '').trim();
  if (!secret) {
    throw new Error('ADMIN_SECRET_KEY is not configured on server');
  }

  const payload = {
    email: email.toLowerCase().trim(),
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Validates an admin session token or secret key header
 */
export function verifyAdminSessionToken(token: string): { valid: boolean; email?: string } {
  const secret = (process.env.ADMIN_SECRET_KEY || ADMIN_SECRET_KEY || '').trim();
  const currentAdminEmail = normalizeEmail(process.env.ADMIN_EMAIL || ADMIN_EMAIL);
  if (!token || !secret) {
    return { valid: false };
  }

  // Direct secret key check (for automated tests / API scripts)
  if (token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    return { valid: true, email: currentAdminEmail };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payloadBase64, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return { valid: false };
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    if (payload.exp < Date.now()) {
      return { valid: false }; // Expired
    }

    const validEmails = [currentAdminEmail, ...ADMIN_EMAILS].map((e) => e.toLowerCase().trim());
    if (!validEmails.includes((payload.email || '').toLowerCase().trim())) {
      return { valid: false }; // Email mismatch
    }

    return { valid: true, email: payload.email };
  } catch {
    return { valid: false };
  }
}

/**
 * Server-side authorization check for Admin API routes
 */
export function isAuthorizedAdmin(request?: Request | NextRequest | null): boolean {
  if (!request) return false;

  // 1. Check HttpOnly admin cookie
  if ('cookies' in request && request.cookies && typeof request.cookies.get === 'function') {
    const cookieToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (cookieToken && verifyAdminSessionToken(cookieToken).valid) {
      return true;
    }
    const userSessionToken = request.cookies.get('indobid_session')?.value;
    if (userSessionToken) {
      const userSession = verifySessionToken(userSessionToken);
      if (
        userSession &&
        (userSession.role === 'founder' ||
          userSession.role === 'admin' ||
          (userSession.email && normalizeEmail(userSession.email) === ADMIN_EMAIL))
      ) {
        return true;
      }
    }
  }

  // 2. Check Cookie header
  if (request.headers && typeof request.headers.get === 'function') {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
      if (match && verifyAdminSessionToken(match[1]).valid) {
        return true;
      }
      const userMatch = cookieHeader.match(/indobid_session=([^;]+)/);
      if (userMatch) {
        const userSession = verifySessionToken(userMatch[1]);
        if (
          userSession &&
          (userSession.role === 'founder' ||
            userSession.role === 'admin' ||
            (userSession.email && normalizeEmail(userSession.email) === ADMIN_EMAIL))
        ) {
          return true;
        }
      }
    }

    // 3. Check Authorization Bearer header
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (verifyAdminSessionToken(token).valid) return true;
      const userSession = verifySessionToken(token);
      if (
        userSession &&
        (userSession.role === 'founder' ||
          userSession.role === 'admin' ||
          (userSession.email && normalizeEmail(userSession.email) === ADMIN_EMAIL))
      ) {
        return true;
      }
    }

    // 4. Check x-admin-key header
    const customHeader = request.headers.get('x-admin-key');
    if (customHeader && verifyAdminSessionToken(customHeader.trim()).valid) {
      return true;
    }
  }

  return false;
}
