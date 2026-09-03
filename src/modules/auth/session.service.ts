/**
 * INDOBID — SESSION SERVICE
 * Manages cryptographic HMAC-SHA256 session token generation, validation, and request resolution.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { env } from '../../config/env';

export const AUTH_COOKIE_NAME = 'indobid_session';
export const ADMIN_SESSION_COOKIE = 'indobid_admin_session';
const SESSION_MAX_AGE_SECONDS = 86400; // 24 hours
const USER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface UserSession {
  userId: string;
  username: string;
  email: string | null;
  displayName: string;
  role: string;
}

export class SessionService {
  private get authSecret(): string {
    return env.AUTH_SECRET || 'indobid_social_jwt_secret_94884210';
  }

  private get adminSecret(): string {
    return env.ADMIN_SECRET_KEY || '';
  }

  createSessionToken(payload: UserSession): string {
    const data = Buffer.from(
      JSON.stringify({ ...payload, exp: Date.now() + USER_SESSION_MAX_AGE_MS })
    ).toString('base64url');
    const signature = crypto.createHmac('sha256', this.authSecret).update(data).digest('base64url');
    return `${data}.${signature}`;
  }

  verifySessionToken(token: string): UserSession | null {
    try {
      const [data, signature] = token.split('.');
      if (!data || !signature) return null;

      const expectedSignature = crypto
        .createHmac('sha256', this.authSecret)
        .update(data)
        .digest('base64url');

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

  async getCurrentUser(request?: NextRequest | Request): Promise<UserSession | null> {
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

      const session = this.verifySessionToken(token);
      if (!session) return null;

      // Verify user exists and is active in database
      const dbUser = await userRepository.findById(session.userId);
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

  createAdminSessionToken(email: string): string {
    const secret = (process.env.ADMIN_SECRET_KEY || this.adminSecret || '').trim();
    if (!secret) {
      throw new Error('ADMIN_SECRET_KEY is not configured on server');
    }

    const payload = {
      email: email.toLowerCase().trim(),
      iat: Date.now(),
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url');

    return `${payloadBase64}.${signature}`;
  }

  verifyAdminSessionToken(token: string): { valid: boolean; email?: string } {
    const secret = (process.env.ADMIN_SECRET_KEY || this.adminSecret || '').trim();
    const currentAdminEmail = env.ADMIN_EMAIL;
    if (!token || !secret) {
      return { valid: false };
    }

    // Direct secret key check (timing-safe)
    if (
      token.length === secret.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
    ) {
      return { valid: true, email: currentAdminEmail };
    }

    try {
      const [payloadBase64, signature] = token.split('.');
      if (!payloadBase64 || !signature) {
        return { valid: false };
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadBase64)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return { valid: false };
      }

      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));
      if (payload.exp && payload.exp < Date.now()) {
        return { valid: false };
      }

      return { valid: true, email: payload.email };
    } catch {
      return { valid: false };
    }
  }
}

export const sessionService = new SessionService();
export const createSessionToken = (payload: UserSession) => sessionService.createSessionToken(payload);
export const verifySessionToken = (token: string) => sessionService.verifySessionToken(token);
export const getCurrentUser = (request?: NextRequest | Request) => sessionService.getCurrentUser(request);
export const createAdminSessionToken = (email: string) => sessionService.createAdminSessionToken(email);
export const verifyAdminSessionToken = (token: string) => sessionService.verifyAdminSessionToken(token);
