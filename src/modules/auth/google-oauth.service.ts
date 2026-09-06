/**
 * INDOBID — GOOGLE OAUTH SERVICE
 * Helper utilities and types for Google OAuth 2.0 flow.
 */

import { NextRequest } from 'next/server';
import { env } from '@/config/env';

export const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';
export const GOOGLE_OAUTH_REDIRECT_URI_COOKIE = 'google_oauth_redirect_uri';
export const GOOGLE_OAUTH_DESTINATION_COOKIE = 'google_oauth_target_redirect';

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export function resolveGoogleRedirectUri(request: NextRequest): string {
  const forwardedHost =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    (request.nextUrl ? request.nextUrl.host : null);

  const forwardedProto =
    request.headers.get('x-forwarded-proto') ||
    (request.nextUrl ? request.nextUrl.protocol.replace(':', '') : null);

  if (forwardedHost) {
    const proto = forwardedProto || (forwardedHost.includes('localhost') ? 'http' : 'https');
    return `${proto}://${forwardedHost}/api/auth/callback/google`;
  }

  const base = (env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/auth/callback/google`;
}
