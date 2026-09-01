import crypto from 'crypto';
import { prisma } from './db';
import { hashPassword, createSessionToken } from './user-auth';

export const RESET_TOKEN_EXPIRY_MINUTES = 60;

/**
 * Generate a cryptographically secure random 32-byte hex token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash the reset token with unique random salt using PBKDF2
 */
export function hashResetToken(token: string, salt: string): string {
  return crypto.pbkdf2Sync(token, salt, 1000, 32, 'sha256').toString('hex');
}

/**
 * Send password reset email via Resend
 */
export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://indobid.lol';
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

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
        subject: 'Reset your IndoBid password',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0A0F11; color: #FFFFFF; border-radius: 20px; border: 1px solid #1B292F;">
            <div style="margin-bottom: 24px; text-align: center;">
              <span style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #D98A6C; font-family: Montserrat, sans-serif;">INDOBID<span style="color: #6C828D; font-size: 14px;">.lol</span></span>
            </div>
            <h2 style="font-size: 18px; font-weight: 700; color: #E6EDF0; margin: 0 0 12px; text-align: center;">Reset your password</h2>
            <p style="color: #8C9FA8; font-size: 13px; line-height: 1.5; text-align: center; margin: 0 0 24px;">
              We received a request to reset your IndoBid password. Click the button below to choose a new password.
            </p>
            <div style="text-align: center; margin: 0 0 24px;">
              <a href="${resetUrl}" style="display: inline-block; background: #D98A6C; color: #071B21; font-weight: 800; font-size: 13px; padding: 14px 28px; border-radius: 12px; text-decoration: none; letter-spacing: -0.2px;">
                Reset Password
              </a>
            </div>
            <p style="color: #6C828D; font-size: 12px; line-height: 1.5; text-align: center; margin: 0 0 16px; word-break: break-all;">
              Or copy and paste this URL into your browser:<br/>
              <a href="${resetUrl}" style="color: #D98A6C; font-size: 11px;">${resetUrl}</a>
            </p>
            <p style="color: #5D727C; font-size: 12px; text-align: center; margin: 0 0 24px;">
              This link is valid for ${RESET_TOKEN_EXPIRY_MINUTES} minutes and can only be used once. If you did not request a password reset, you can safely ignore this email.
            </p>
            <hr style="border: 0; border-top: 1px solid #1B292F; margin: 0 0 20px;" />
            <p style="color: #4A5D66; font-size: 11px; text-align: center; margin: 0;">
              © 2026 IndoBid.lol · Don't just say it. Back it.
            </p>
          </div>
        `,
        text: `IndoBid\n\nReset your IndoBid password\n\nWe received a request to reset your password. Use the following link to set a new password:\n\n${resetUrl}\n\nThis link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes. If you did not request this, you can ignore this email.\n\n© 2026 IndoBid.lol`,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('Resend API error sending password reset:', errData);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send password reset email via Resend:', err);
    return false;
  }
}

/**
 * Request a password reset email
 * Always returns a generic success message to prevent user enumeration
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const genericResponse = {
    success: true,
    message: "If an account exists for this email, we've sent password reset instructions.",
  };

  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return genericResponse;
  }

  // Check if user exists
  const user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
  });

  if (!user || user.isSuspended) {
    return genericResponse;
  }

  // Invalidate any existing unused reset tokens for this email
  await (prisma as any).passwordResetToken.updateMany({
    where: { email: cleanEmail, used: false },
    data: { used: true },
  });

  // Generate cryptographically secure token & salt
  const rawToken = generateResetToken();
  const salt = crypto.randomBytes(16).toString('hex');
  const tokenHash = hashResetToken(rawToken, salt);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Store token hash in database
  await (prisma as any).passwordResetToken.create({
    data: {
      email: cleanEmail,
      tokenHash,
      salt,
      expiresAt,
      used: false,
    },
  });

  // Send password reset email
  await sendPasswordResetEmail(cleanEmail, rawToken);

  return genericResponse;
}

/**
 * Verify validity of a password reset token
 */
export async function verifyPasswordResetToken(
  email: string,
  token: string
): Promise<{ valid: boolean; error?: string }> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanToken = (token || '').trim();

  if (!cleanEmail || !cleanToken) {
    return { valid: false, error: 'Invalid or missing password reset credentials.' };
  }

  const resetRecord = await (prisma as any).passwordResetToken.findFirst({
    where: {
      email: cleanEmail,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!resetRecord) {
    return { valid: false, error: 'Invalid or expired password reset link. Please request a new one.' };
  }

  const computedHash = hashResetToken(cleanToken, resetRecord.salt);
  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(resetRecord.tokenHash, 'hex')
    );
  } catch {
    isMatch = false;
  }

  if (!isMatch) {
    return { valid: false, error: 'Invalid or expired password reset link. Please request a new one.' };
  }

  return { valid: true };
}

/**
 * Reset password using valid reset token
 */
export async function resetPasswordWithToken(
  email: string,
  token: string,
  newPassword: string
): Promise<{
  success: boolean;
  token?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    role: string;
  };
  error?: string;
}> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const cleanToken = (token || '').trim();

  if (!cleanEmail || !cleanToken) {
    return { success: false, error: 'Invalid or missing password reset credentials.' };
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  const resetRecord = await (prisma as any).passwordResetToken.findFirst({
    where: {
      email: cleanEmail,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!resetRecord) {
    return { success: false, error: 'Invalid or expired password reset link. Please request a new one.' };
  }

  const computedHash = hashResetToken(cleanToken, resetRecord.salt);
  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(resetRecord.tokenHash, 'hex')
    );
  } catch {
    isMatch = false;
  }

  if (!isMatch) {
    return { success: false, error: 'Invalid or expired password reset link. Please request a new one.' };
  }

  // Mark token as used immediately
  await (prisma as any).passwordResetToken.update({
    where: { id: resetRecord.id },
    data: { used: true },
  });

  // Find user
  const user = await prisma.user.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
  });

  if (!user) {
    return { success: false, error: 'User account not found.' };
  }

  if (user.isSuspended) {
    return { success: false, error: 'This account has been suspended. Please contact support.' };
  }

  // Hash new password and update user record
  const newPasswordHash = hashPassword(newPassword);
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      emailVerifiedAt: user.emailVerifiedAt || new Date(),
    },
  });

  const sessionPayload = {
    userId: updatedUser.id,
    username: updatedUser.username || 'user',
    email: updatedUser.email,
    displayName: updatedUser.displayName || updatedUser.username || 'Debater',
    role: updatedUser.role,
  };

  const sessionToken = createSessionToken(sessionPayload);

  return {
    success: true,
    token: sessionToken,
    user: {
      id: updatedUser.id,
      username: sessionPayload.username,
      displayName: sessionPayload.displayName,
      email: sessionPayload.email,
      role: sessionPayload.role,
    },
  };
}
