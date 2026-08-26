import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_EMAIL,
  ADMIN_SECRET_KEY,
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  checkAdminLoginRateLimit,
  recordFailedAdminLogin,
  clearAdminLoginRateLimit,
} from '@/lib/auth';
import { getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  secretKey: z.string().min(1, 'Secret key is required'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // 1. Check rate limit
    const rateCheck = checkAdminLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Access temporarily suspended. Please retry in ${rateCheck.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    // 2. Validate input
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { email, secretKey } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 3. Verify allowed email & secret key server-side
    const isEmailValid = normalizedEmail === ADMIN_EMAIL;
    const isSecretValid = ADMIN_SECRET_KEY && secretKey.trim() === ADMIN_SECRET_KEY;

    if (!isEmailValid || !isSecretValid) {
      recordFailedAdminLogin(ip);
      return NextResponse.json(
        { error: 'Invalid admin credentials. Access denied.' },
        { status: 403 }
      );
    }

    // 4. Success: Clear rate limit record
    clearAdminLoginRateLimit(ip);

    // 5. Generate secure session token
    const token = createAdminSessionToken(normalizedEmail);

    // 6. Return response with HttpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      email: normalizedEmail,
      message: 'Admin session authenticated successfully',
    });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server authentication error' },
      { status: 500 }
    );
  }
}
