import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailOtp } from '@/lib/email-otp';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const AUTH_COOKIE_NAME = 'indobid_session';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`otp_verify_${ip}`, 15, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, code, otp, username, displayName } = body || {};
    const otpCode = (otp || code || '').toString().trim();

    if (!email || typeof email !== 'string' || !otpCode) {
      return NextResponse.json(
        { success: false, error: 'Email and 6-digit OTP code are required.' },
        { status: 400 }
      );
    }

    const result = await verifyEmailOtp(email, otpCode, { username, displayName });

    if (!result.success || !result.token) {
      return NextResponse.json(
        { success: false, error: result.error || 'Verification failed.' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: result.user,
    });

    // Set secure authentication cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('OTP Verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication verification failed' },
      { status: 500 }
    );
  }
}
