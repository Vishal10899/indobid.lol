import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/user-auth';
import { requestEmailOtp } from '@/lib/email-otp';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`signup_${ip}`, 10, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: 'Too many signup attempts. Please wait a moment.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { username, email, password, displayName, avatarUrl } = body || {};

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

    // 3. Check for existing username or verified email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { email: cleanEmail },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername && existingUser.email !== cleanEmail) {
        return NextResponse.json(
          { success: false, error: 'Username is already taken' },
          { status: 409 }
        );
      }
      if (existingUser.email === cleanEmail && existingUser.emailVerifiedAt !== null) {
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

    // 5. Create or update pending unverified user record
    if (existingUser && existingUser.email === cleanEmail) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          username: cleanUsername,
          displayName: displayName?.trim() || cleanUsername,
          passwordHash,
          avatarUrl: validAvatarUrl || existingUser.avatarUrl,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          username: cleanUsername,
          displayName: displayName?.trim() || cleanUsername,
          email: cleanEmail,
          passwordHash,
          avatarUrl: validAvatarUrl,
          emailVerifiedAt: null, // Requires OTP verification
        },
      });
    }

    // 6. Generate and send 6-digit OTP verification code
    const otpRes = await requestEmailOtp(cleanEmail);
    if (!otpRes.success) {
      return NextResponse.json(
        { success: false, error: otpRes.error || 'Failed to send verification code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      email: cleanEmail,
      message: 'We sent a 6-digit code to your email.',
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
