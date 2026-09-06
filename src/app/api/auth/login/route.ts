import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/user-auth';
import { requestEmailOtp } from '@/lib/email-otp';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isFounder } from '@/lib/founder';
import { detectContactType, normalizePhoneNumber } from '@/modules/auth/auth.validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`login_${ip}`, 15, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { login, password } = body || {};

    if (!login || !password) {
      return NextResponse.json(
        { success: false, error: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const cleanLogin = login.trim().toLowerCase();
    const isPhone = detectContactType(cleanLogin) === 'phone';
    const normalizedPhone = isPhone ? normalizePhoneNumber(cleanLogin) : null;
    const phoneDigits = isPhone ? cleanLogin.replace(/\D/g, '') : null;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanLogin },
          { email: cleanLogin },
          ...(normalizedPhone ? [
            { username: normalizedPhone },
            { email: normalizedPhone },
          ] : []),
          ...(phoneDigits && phoneDigits !== cleanLogin ? [
            { username: phoneDigits },
            { email: phoneDigits },
          ] : []),
        ],
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    if (user.isSuspended) {
      return NextResponse.json(
        { success: false, error: 'Your account has been suspended by moderation' },
        { status: 403 }
      );
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Require email verification for unverified accounts (excluding founder/admin)
    const isFounderOrAdmin = isFounder(user);

    if (user.emailVerifiedAt === null && !user.isVerified && !isFounderOrAdmin) {
      if (user.email) {
        await requestEmailOtp(user.email);
      }
      return NextResponse.json(
        {
          success: false,
          requiresVerification: true,
          email: user.email,
          error: 'Please verify your email before logging in. We sent a 6-digit code to your email.',
        },
        { status: 403 }
      );
    }

    const sessionPayload = {
      userId: user.id,
      username: user.username || 'user',
      email: user.email,
      displayName: user.displayName || user.username || 'Debater',
      role: user.role,
    };

    const token = createSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
