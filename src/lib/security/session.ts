/**
 * INDOBID — SESSION SECURITY & COOKIE TOKENS
 */

import crypto from 'crypto';
import { env } from '../../config/env';

export interface SessionPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  isVerified?: boolean;
  createdAt: number;
}

export function createSessionToken(payload: Omit<SessionPayload, 'createdAt'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    createdAt: Date.now(),
  };

  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', env.AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) return null;

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) return null;

  try {
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    return JSON.parse(payloadJson) as SessionPayload;
  } catch {
    return null;
  }
}
