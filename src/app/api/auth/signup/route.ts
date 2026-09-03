import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/user-auth';
import { requestEmailOtp } from '@/lib/email-otp';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeEmail, ADMIN_EMAIL } from '@/lib/auth';
import { isValidCountryCode, getCurrencyForCountry } from '@/lib/money';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,25}$/;

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
    // Intentionally discard and ignore any client-controlled role, isFounder, isAdmin fields
    const { username, email, password, displayName, avatarUrl } = body || {};

    const rawCountry = typeof body?.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : undefined;
    const countryCode = rawCountry && isValidCountryCode(rawCountry) ? rawCountry : 'IN';
    const currencyCode = getCurrencyForCountry(countryCode);

    // 1. Mandatory Username Validation & Deterministic Normalization
    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(cleanUsername)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username must be between 3 and 25 characters (lowercase letters, numbers, and underscores only)',
        },
        { status: 400 }
      );
    }

    // 2. Password Validation
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // 3. Mandatory Email Validation & Normalization
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Server-side authoritative Founder role determination: exclusively ADMIN_EMAIL
    const isFounderEmail = cleanEmail === ADMIN_EMAIL;
    const serverRole = isFounderEmail ? 'founder' : 'user';

    // 4. Pre-check Database for Existing Username (Deterministic & Case-Insensitive)
    const userByUsername = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (userByUsername && userByUsername.email !== cleanEmail) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken' },
        { status: 409 }
      );
    }

    // 5. Pre-check Database for Existing Email
    const userByEmail = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (userByEmail && userByEmail.emailVerifiedAt !== null) {
      return NextResponse.json(
        { success: false, error: 'An account with this email address already exists' },
        { status: 409 }
      );
    }

    // If existing unverified email account is changing username, ensure new username isn't taken
    if (userByEmail && userByUsername && userByUsername.id !== userByEmail.id) {
      return NextResponse.json(
        { success: false, error: 'Username is already taken' },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);

    // 6. Optional Avatar URL validation
    let validAvatarUrl: string | null = null;
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim()) {
      const trimmed = avatarUrl.trim();
      if (trimmed.startsWith('data:image/') || trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
        validAvatarUrl = trimmed;
      }
    }

    // 7. Atomic Create or Update Pending Unverified User Record
    try {
      if (userByEmail) {
        await prisma.user.update({
          where: { id: userByEmail.id },
          data: {
            username: cleanUsername,
            displayName: displayName?.trim() || cleanUsername,
            passwordHash,
            avatarUrl: validAvatarUrl || userByEmail.avatarUrl,
            role: isFounderEmail ? 'founder' : userByEmail.role,
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
            role: serverRole,
            isVerified: isFounderEmail,
            emailVerifiedAt: isFounderEmail ? new Date() : null,
            countryCode,
            currencyCode,
          },
        });
      }
    } catch (dbErr: any) {
      // Handle race condition unique constraint violations atomically
      if (dbErr?.code === 'P2002') {
        const target = dbErr?.meta?.target;
        if (Array.isArray(target) ? target.includes('username') : target?.includes?.('username')) {
          return NextResponse.json(
            { success: false, error: 'Username is already taken' },
            { status: 409 }
          );
        }
        if (Array.isArray(target) ? target.includes('email') : target?.includes?.('email')) {
          return NextResponse.json(
            { success: false, error: 'An account with this email address already exists' },
            { status: 409 }
          );
        }
      }
      throw dbErr;
    }

    // 8. Generate and Send 6-Digit Email OTP Verification Code
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
      username: cleanUsername,
      countryCode,
      currencyCode,
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
