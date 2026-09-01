import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/password-reset';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`forgot_password_${ip}`, 5, 60); // max 5 requests per minute per IP
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many password reset requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = body?.email;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: true, message: "If an account exists for this email, we've sent password reset instructions." },
        { status: 200 }
      );
    }

    const result = await requestPasswordReset(email);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: true, message: "If an account exists for this email, we've sent password reset instructions." },
      { status: 200 }
    );
  }
}
