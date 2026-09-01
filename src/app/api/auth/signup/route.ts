import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/user-auth';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, email, password, displayName, avatarUrl } = body;

    // 1. Mandatory Username & Password Validation
    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // 2. Mandatory Email Validation
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3 || cleanUsername.length > 25) {
      return NextResponse.json(
        { success: false, error: 'Username must be between 3 and 25 characters (alphanumeric and underscore)' },
        { status: 400 }
      );
    }

    // 3. Prevent duplicate account using database constraints & lookup
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { email: cleanEmail },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return NextResponse.json(
          { success: false, error: 'Username is already taken' },
          { status: 409 }
        );
      }
      if (existingUser.email === cleanEmail) {
        return NextResponse.json(
          { success: false, error: 'An account with this email address already exists' },
          { status: 409 }
        );
      }
    }

    const passwordHash = hashPassword(password);

    // 4. Optional Avatar URL validation if passed on signup
    let validAvatarUrl: string | null = null;
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
      const trimmed = avatarUrl.trim();
      if (trimmed.startsWith('data:image/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
        validAvatarUrl = trimmed;
      }
    }

    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        displayName: displayName?.trim() || cleanUsername,
        email: cleanEmail,
        passwordHash,
        avatarUrl: validAvatarUrl,
      },
    });

    const sessionPayload = {
      userId: user.id,
      username: user.username!,
      email: user.email,
      displayName: user.displayName || user.username!,
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
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
