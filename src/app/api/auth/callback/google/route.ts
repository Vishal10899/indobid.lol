import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { env } from '@/config/env';
import { userRepository } from '@/infrastructure/database/repositories/user.repository';
import { passwordService } from '@/modules/auth/password.service';
import { sessionService, AUTH_COOKIE_NAME } from '@/modules/auth/session.service';
import {
  resolveGoogleRedirectUri,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_REDIRECT_URI_COOKIE,
  GOOGLE_OAUTH_DESTINATION_COOKIE,
  GoogleUserInfo,
} from '@/modules/auth/google-oauth.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectUri = request.cookies.get(GOOGLE_OAUTH_REDIRECT_URI_COOKIE)?.value || resolveGoogleRedirectUri(request);
  const baseUrl = redirectUri.replace(/\/api\/auth\/callback\/google$/, '');

  // 1. Check for provider error (e.g. user canceled Google login)
  const oauthError = searchParams.get('error');
  if (oauthError) {
    console.warn('[Google OAuth] Authorization error returned from Google:', oauthError);
    return NextResponse.redirect(new URL('/?error=google_oauth_denied', baseUrl));
  }

  // 2. Validate CSRF State
  const stateFromQuery = searchParams.get('state');
  const stateFromCookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
    console.warn('[Google OAuth] State mismatch or missing CSRF token');
    return NextResponse.redirect(new URL('/?error=google_oauth_state_mismatch', baseUrl));
  }

  // 3. Ensure Authorization Code exists
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/?error=google_oauth_missing_code', baseUrl));
  }

  // 4. Validate Server Configuration
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[Google OAuth] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing');
    return NextResponse.redirect(new URL('/?error=google_oauth_unavailable', baseUrl));
  }

  try {
    // 5. Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('[Google OAuth] Token exchange failed:', tokenResponse.status, errText);
      return NextResponse.redirect(new URL('/?error=google_oauth_failed', baseUrl));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const idToken = tokenData.id_token;

    if (!accessToken && !idToken) {
      console.error('[Google OAuth] No access_token or id_token returned');
      return NextResponse.redirect(new URL('/?error=google_oauth_failed', baseUrl));
    }

    // 6. Fetch Google User Profile info
    let userInfo: GoogleUserInfo | null = null;

    if (accessToken) {
      try {
        const userinfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (userinfoRes.ok) {
          userInfo = (await userinfoRes.json()) as GoogleUserInfo;
        }
      } catch (userinfoErr) {
        console.warn('[Google OAuth] Userinfo endpoint call failed, falling back to id_token:', userinfoErr);
      }
    }

    // Fallback: parse id_token payload if userinfo endpoint was unreachable
    if (!userInfo && idToken) {
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
          userInfo = {
            sub: payload.sub,
            email: payload.email,
            email_verified: Boolean(payload.email_verified),
            name: payload.name,
            picture: payload.picture,
          };
        }
      } catch (e) {
        console.error('[Google OAuth] Failed to decode id_token payload:', e);
      }
    }

    if (!userInfo || !userInfo.email) {
      console.error('[Google OAuth] Failed to retrieve email from Google profile');
      return NextResponse.redirect(new URL('/?error=google_oauth_failed', baseUrl));
    }

    const cleanEmail = userInfo.email.toLowerCase().trim();
    const isFounderEmail = cleanEmail === env.ADMIN_EMAIL;

    // 7. Find existing user or provision new IndoBid user
    let user = await userRepository.findByEmail(cleanEmail);

    if (!user) {
      // Determine unique candidate username
      const emailPrefix = cleanEmail
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .substring(0, 15);

      const nameBase = (userInfo.name || '')
        .toLowerCase()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .substring(0, 15);

      const baseUsername = isFounderEmail ? 'vishalkumar' : nameBase || emailPrefix || 'debater';
      let candidateUsername = baseUsername;
      let counter = 0;

      while (await userRepository.findByUsername(candidateUsername)) {
        if (isFounderEmail && counter === 0) break;
        candidateUsername = `${baseUsername.substring(0, 10)}_${Math.floor(1000 + Math.random() * 9000)}`;
        counter++;
        if (counter > 10) {
          candidateUsername = `user_${crypto.randomBytes(4).toString('hex')}`;
          break;
        }
      }

      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = passwordService.hashPassword(randomPassword);

      user = await userRepository.create({
        email: cleanEmail,
        username: candidateUsername,
        displayName: userInfo.name?.trim() || (isFounderEmail ? 'Vishal Kumar' : candidateUsername),
        avatarUrl: userInfo.picture || null,
        passwordHash,
        isVerified: true,
        emailVerifiedAt: new Date(),
        role: isFounderEmail ? 'founder' : 'user',
        bio: isFounderEmail ? 'Founder of IndoBid · Back opinions with conviction.' : undefined,
      });
    } else {
      // Update existing user verification and avatar if needed
      user = await userRepository.update(user.id, {
        isVerified: true,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        role: isFounderEmail ? 'founder' : user.role,
        avatarUrl: user.avatarUrl || userInfo.picture || null,
        displayName: user.displayName || userInfo.name?.trim() || undefined,
      });
    }

    // 8. Issue standard IndoBid session token
    const userSession = {
      userId: user.id,
      username: user.username || 'user',
      email: user.email,
      displayName: user.displayName || user.username || 'Debater',
      role: user.role,
    };

    const sessionToken = sessionService.createSessionToken(userSession);

    // 9. Redirect authenticated user to destination
    const destinationPath = request.cookies.get(GOOGLE_OAUTH_DESTINATION_COOKIE)?.value;
    const safeDestination = destinationPath && destinationPath.startsWith('/') && !destinationPath.startsWith('//')
      ? destinationPath
      : '/';

    const destination = new URL(safeDestination, baseUrl);
    const response = NextResponse.redirect(destination);

    // Set secure authentication cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Clear one-time OAuth state cookies
    response.cookies.set({
      name: GOOGLE_OAUTH_STATE_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    response.cookies.set({
      name: GOOGLE_OAUTH_REDIRECT_URI_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    response.cookies.set({
      name: GOOGLE_OAUTH_DESTINATION_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('[Google OAuth] Callback handler unhandled error:', error);
    return NextResponse.redirect(new URL('/?error=google_oauth_failed', baseUrl));
  }
}
