import { NextRequest, NextResponse } from 'next/server';
import { requestOtp } from '@/lib/email-otp';
import { detectContactType, isValidEmail, isValidPhoneNumber } from '@/modules/auth/auth.validation';
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
    const rawTarget = body?.target || body?.phone || body?.email;

    if (!rawTarget || typeof rawTarget !== 'string' || !rawTarget.trim()) {
      return NextResponse.json(
        { success: false, error: 'Please enter your email or phone number.' },
        { status: 400 }
      );
    }

    const cleanTarget = rawTarget.trim();
    const contactType = detectContactType(cleanTarget);

    if (contactType === 'phone') {
      if (!isValidPhoneNumber(cleanTarget)) {
        return NextResponse.json(
          { success: false, error: 'Please enter a valid phone number.' },
          { status: 400 }
        );
      }
    } else if (contactType === 'email') {
      if (!isValidEmail(cleanTarget)) {
        return NextResponse.json(
          { success: false, error: 'Please enter a valid email address.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid phone number or email address.' },
        { status: 400 }
      );
    }

    const result = await requestOtp(cleanTarget, contactType === 'phone' ? 'phone' : 'email');
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
