import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { env } from '@/config/env';
import {
  resolveGoogleRedirectUri,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_REDIRECT_URI_COOKIE,
  GOOGLE_OAUTH_DESTINATION_COOKIE,
} from '@/modules/auth/google-oauth.service';

export { resolveGoogleRedirectUri };

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const clientId = env.GOOGLE_CLIENT_ID;
    const redirectUri = resolveGoogleRedirectUri(request);
    const baseUrl = redirectUri.replace(/\/api\/auth\/callback\/google$/, '');

    if (!clientId) {
      // Clean fallback if Google OAuth credentials are not yet configured on server
      return NextResponse.redirect(new URL('/?error=google_oauth_unavailable', baseUrl));
    }

    // Cryptographic CSRF state token
    const state = crypto.randomBytes(32).toString('hex');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'select_account');

    const response = NextResponse.redirect(authUrl.toString());

    // Secure HTTP-only cookies to verify state and redirect URI during callback
    response.cookies.set({
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    response.cookies.set({
      name: GOOGLE_OAUTH_REDIRECT_URI_COOKIE,
      value: redirectUri,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });

    // Handle return target redirect if present
    const destinationParam = request.nextUrl.searchParams.get('redirect');
    if (destinationParam && destinationParam.startsWith('/') && !destinationParam.startsWith('//')) {
      response.cookies.set({
        name: GOOGLE_OAUTH_DESTINATION_COOKIE,
        value: destinationParam,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      });
    }

    return response;
  } catch (error) {
    console.error('Google OAuth initialization error:', error);
    const redirectUri = resolveGoogleRedirectUri(request);
    const baseUrl = redirectUri.replace(/\/api\/auth\/callback\/google$/, '');
    return NextResponse.redirect(new URL('/?error=google_oauth_failed', baseUrl));
  }
}
