import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/user-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { login, password } = body; // login can be username or email

    if (!login || !password) {
      return NextResponse.json(
        { success: false, error: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const cleanLogin = login.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanLogin },
          { email: cleanLogin },
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
