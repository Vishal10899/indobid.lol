import { NextRequest, NextResponse } from 'next/server';
import { requestEmailOtp } from '@/lib/email-otp';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`otp_send_${ip}`, 10, 60); // max 10 sends per min per IP
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const result = await requestEmailOtp(email);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send OTP.',
          cooldownRemaining: result.cooldownRemaining,
        },
        { status: result.cooldownRemaining ? 429 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('OTP Send error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
