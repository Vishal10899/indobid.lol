import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/password-reset';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { AUTH_COOKIE_NAME } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`reset_password_${ip}`, 10, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, token, newPassword } = body || {};

    if (!email || typeof email !== 'string' || !token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email and reset token are required.' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const result = await resetPasswordWithToken(email, token, newPassword);

    if (!result.success || !result.token) {
      return NextResponse.json(
        { success: false, error: result.error || 'Password reset failed.' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Password successfully updated.',
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
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password.' },
      { status: 500 }
    );
  }
}
