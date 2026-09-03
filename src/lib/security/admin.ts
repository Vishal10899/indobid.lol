/**
 * INDOBID — FOUNDER & ADMIN AUTHORIZATION SECURITY
 */

import crypto from 'crypto';
import { env } from '../../config/env';
import { securityConfig } from '../../config/security';

const adminLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function verifyAdminSecret(inputSecret: string): boolean {
  const secret = env.ADMIN_SECRET_KEY.trim();
  if (!secret || !inputSecret) return false;

  const bufA = Buffer.from(inputSecret);
  const bufB = Buffer.from(secret);
  if (bufA.length !== bufB.length) return false;

  return crypto.timingSafeEqual(bufA, bufB);
}

export function isFounderEmail(email: string): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === env.ADMIN_EMAIL.toLowerCase().trim();
}

export function checkAdminLoginRateLimit(ip: string): { allowed: boolean; remainingSeconds: number } {
  const now = Date.now();
  const record = adminLoginAttempts.get(ip);

  if (record && record.lockedUntil > now) {
    return { allowed: false, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  if (!record || record.lockedUntil <= now) {
    adminLoginAttempts.set(ip, { count: 0, lockedUntil: 0 });
  }

  return { allowed: true, remainingSeconds: 0 };
}

export function recordAdminLoginAttempt(ip: string, success: boolean): void {
  const now = Date.now();
  if (success) {
    adminLoginAttempts.delete(ip);
    return;
  }

  const record = adminLoginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;

  if (record.count >= securityConfig.rateLimits.ADMIN_LOGIN.limit) {
    record.lockedUntil = now + securityConfig.rateLimits.ADMIN_LOGIN.windowMs; // 15-minute lockout
  }

  adminLoginAttempts.set(ip, record);
}
