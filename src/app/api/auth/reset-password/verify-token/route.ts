import { NextRequest, NextResponse } from 'next/server';
import { verifyPasswordResetToken } from '@/lib/password-reset';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`verify_reset_token_${ip}`, 20, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { valid: false, error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, token } = body || {};

    if (!email || !token) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or missing credentials.' },
        { status: 400 }
      );
    }

    const result = await verifyPasswordResetToken(email, token);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Verify reset token error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to verify token.' },
      { status: 500 }
    );
  }
}
