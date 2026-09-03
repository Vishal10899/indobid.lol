import crypto from 'crypto';
import { prisma } from './db';
import { hashPassword, createSessionToken } from './user-auth';
import { ADMIN_EMAIL } from './auth';

export const OTP_EXPIRY_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_OTP_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit numeric OTP code
 */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash the OTP code with unique random salt using PBKDF2
 */
export function hashOtpCode(code: string, salt: string): string {
  return crypto.pbkdf2Sync(code, salt, 1000, 32, 'sha256').toString('hex');
}

/**
 * Deliver OTP email via Resend API (with simulated delivery in test/dev environments)
 */
export async function sendOtpEmail(email: string, code: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    console.error('RESEND_API_KEY is not configured in production environment.');
    return false;
  }

  try {
    const fromAddress = process.env.EMAIL_FROM || 'IndoBid <noreply@indobid.lol>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject: 'Verify your IndoBid email',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 460px; margin: 0 auto; padding: 32px 24px; background: #0A0F11; color: #FFFFFF; border-radius: 20px; border: 1px solid #1B292F;">
            <div style="margin-bottom: 24px; text-align: center;">
              <span style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #D98A6C; font-family: Montserrat, sans-serif;">INDOBID<span style="color: #6C828D; font-size: 14px;">.lol</span></span>
            </div>
            <h2 style="font-size: 18px; font-weight: 700; color: #E6EDF0; margin: 0 0 12px; text-align: center;">Verify your IndoBid email</h2>
            <p style="color: #8C9FA8; font-size: 13px; line-height: 1.5; text-align: center; margin: 0 0 24px;">
              Enter this 6-digit verification code to activate your IndoBid account and back opinions with conviction.
            </p>
            <div style="background: #111B1F; border: 1px solid #23353D; padding: 18px; text-align: center; border-radius: 14px; margin: 0 0 24px;">
              <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #E8A88A; font-family: monospace;">${code}</span>
            </div>
            <p style="color: #5D727C; font-size: 12px; text-align: center; margin: 0 0 24px;">
              This code will expire in ${OTP_EXPIRY_MINUTES} minutes. If you didn't create this account, you can ignore this email.
            </p>
            <hr style="border: 0; border-top: 1px solid #1B292F; margin: 0 0 20px;" />
            <p style="color: #4A5D66; font-size: 11px; text-align: center; margin: 0;">
              © 2026 IndoBid.lol · Don't just say it. Back it.
            </p>
          </div>
        `,
        text: `IndoBid\n\nVerify your IndoBid email\n\nYour 6-digit verification code is: ${code}\n\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes. If you didn't create this account, you can ignore this email.\n\n© 2026 IndoBid.lol`,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('Resend API error:', errData);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send email via Resend:', err);
    return false;
  }
}

/**
 * Request an Email OTP code with rate limit and 60-second cooldown check
 */
export async function requestEmailOtp(
  email: string
): Promise<{ success: boolean; message?: string; cooldownRemaining?: number; error?: string }> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  // 1. Check 60-second resend cooldown on most recent OTP
  const recentOtp = await prisma.emailOtp.findFirst({
    where: { email: cleanEmail },
    orderBy: { createdAt: 'desc' },
  });

  if (recentOtp) {
    const elapsedSeconds = (Date.now() - recentOtp.lastSentAt.getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      return {
        success: false,
        cooldownRemaining: remaining,
        error: `Please wait ${remaining} second${remaining === 1 ? '' : 's'} before requesting a new code.`,
      };
    }
  }

  // 2. Abuse prevention rate limit: max 5 active OTP requests per 10 minutes
  const recentOtpsCount = await prisma.emailOtp.count({
    where: {
      email: cleanEmail,
      createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  if (recentOtpsCount >= 5) {
    return {
      success: false,
      error: 'Too many OTP requests. Please wait a few minutes before trying again.',
    };
  }

  // 3. Invalidate any existing unused OTPs for this email
  await prisma.emailOtp.updateMany({
    where: { email: cleanEmail, used: false },
    data: { used: true },
  });

  // 4. Generate 6-digit code and random salt
  const code = generateOtpCode();
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = hashOtpCode(code, salt);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const now = new Date();

  // 5. Persist to database
  const createdOtp = await prisma.emailOtp.create({
    data: {
      email: cleanEmail,
      codeHash,
      salt,
      expiresAt,
      lastSentAt: now,
    },
  });

  // 6. Send email via Resend / simulated service
  const sent = await sendOtpEmail(cleanEmail, code);
  if (!sent && process.env.NODE_ENV === 'production') {
    await prisma.emailOtp.delete({ where: { id: createdOtp.id } });
    return {
      success: false,
      error: 'Unable to send verification email at this moment. Please try again.',
    };
  }

  return {
    success: true,
    message: 'We sent a 6-digit code to your email.',
  };
}

/**
 * Verify Email OTP code, mark email verified, and establish authenticated session
 */
export async function verifyEmailOtp(
  email: string,
  code: string,
  options?: { username?: string; displayName?: string }
): Promise<{
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    role: string;
    isVerified: boolean;
  };
  error?: string;
}> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanCode = (code || '').trim();

  if (!cleanEmail) {
    return { success: false, error: 'Email address is required.' };
  }

  if (!cleanCode || cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return { success: false, error: 'Please enter a valid 6-digit numeric verification code.' };
  }

  // Find latest active, non-used OTP for this email
  const otpRecord = await prisma.emailOtp.findFirst({
    where: {
      email: cleanEmail,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    return { success: false, error: 'Invalid or expired verification code. Please request a new one.' };
  }

  // Check attempt limit
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });
    return { success: false, error: 'Too many failed attempts. Please request a new verification code.' };
  }

  // Verify hash using constant-time comparison
  const computedHash = hashOtpCode(cleanCode, otpRecord.salt);
  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(otpRecord.codeHash, 'hex'));
  } catch {
    isMatch = false;
  }

  if (!isMatch) {
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1);
    return {
      success: false,
      error: `Incorrect code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new code.'}`,
    };
  }

  // Mark OTP as used
  await prisma.emailOtp.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  // Find existing user or auto-provision
  let user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
  });

  const isFounderAccount = cleanEmail === ADMIN_EMAIL;

  if (user) {
    if (user.isSuspended) {
      return { success: false, error: 'Your account has been suspended. Please contact support.' };
    }

    // Mark user email verified
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        isVerified: user.isVerified || isFounderAccount,
        role: isFounderAccount ? 'founder' : user.role,
      },
    });
  } else {
    // Auto-provision user account
    let baseUsername = (options?.username || cleanEmail.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 18);

    if (!baseUsername || baseUsername.length < 3) {
      baseUsername = `user_${crypto.randomBytes(3).toString('hex')}`;
    }

    let uniqueUsername = baseUsername;
    let counter = 1;

    while (await prisma.user.findUnique({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${baseUsername}_${counter++}`;
    }

    const displayName = options?.displayName || options?.username || baseUsername;

    user = await prisma.user.create({
      data: {
        email: cleanEmail,
        username: uniqueUsername,
        displayName,
        passwordHash: hashPassword(crypto.randomBytes(32).toString('hex')),
        isVerified: isFounderAccount,
        emailVerifiedAt: new Date(),
        role: isFounderAccount ? 'founder' : 'user',
      },
    });
  }

  const finalUsername = user.username || `user_${user.id.slice(-6)}`;
  const finalDisplayName = user.displayName || finalUsername;

  // Create authoritative session token
  const token = createSessionToken({
    userId: user.id,
    username: finalUsername,
    email: user.email,
    displayName: finalDisplayName,
    role: user.role,
  });

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: finalUsername,
      displayName: finalDisplayName,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    },
  };
}
