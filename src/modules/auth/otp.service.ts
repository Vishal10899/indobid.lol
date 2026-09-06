/**
 * INDOBID — EMAIL OTP SERVICE
 * Centralizes cryptographic one-time password generation, validation, cooldown, and auto-provisioning.
 */

import crypto from 'crypto';
import { otpRepository } from '../../infrastructure/database/repositories/otp.repository';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { passwordService } from './password.service';
import { sessionService } from './session.service';
import { env } from '../../config/env';
import {
  detectContactType,
  isValidEmail,
  normalizePhoneNumber,
  isValidPhoneNumber,
} from './auth.validation';

export const OTP_EXPIRY_MINUTES = 10;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_OTP_ATTEMPTS = 5;

export class OtpService {
  generateOtpCode(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  hashOtpCode(code: string, salt: string): string {
    return crypto.pbkdf2Sync(code, salt, 1000, 32, 'sha256').toString('hex');
  }

  async sendOtpEmail(email: string, code: string): Promise<boolean> {
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      if (!env.isProduction) {
        return true;
      }
      console.error('RESEND_API_KEY is not configured in production environment.');
      return false;
    }

    try {
      const fromAddress = env.EMAIL_FROM || 'IndoBid <noreply@indobid.lol>';
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

  async requestEmailOtp(
    email: string
  ): Promise<{ success: boolean; message?: string; cooldownRemaining?: number; error?: string }> {
    const clean = (email || '').trim();
    if (detectContactType(clean) === 'phone') {
      return this.requestOtp(clean, 'phone');
    }

    const cleanEmail = clean.toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    return this.requestOtp(cleanEmail, 'email');
  }

  async requestOtp(
    target: string,
    explicitType?: 'email' | 'phone'
  ): Promise<{ success: boolean; message?: string; cooldownRemaining?: number; error?: string }> {
    const cleanTarget = (target || '').trim();
    if (!cleanTarget) {
      return { success: false, error: 'Please enter your email or phone number.' };
    }

    const detectedType = explicitType || detectContactType(cleanTarget);

    if (detectedType === 'phone') {
      if (!isValidPhoneNumber(cleanTarget)) {
        return { success: false, error: 'Please enter a valid phone number.' };
      }
      const normalizedPhone = normalizePhoneNumber(cleanTarget);

      // 1. Check 60-second resend cooldown
      const latestOtp = await otpRepository.findLatestByEmail(normalizedPhone);
      if (latestOtp) {
        const secondsSinceLastSent = (Date.now() - new Date(latestOtp.lastSentAt).getTime()) / 1000;
        if (secondsSinceLastSent < RESEND_COOLDOWN_SECONDS) {
          const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLastSent);
          return {
            success: false,
            error: `Please wait ${remaining}s before requesting a new code.`,
            cooldownRemaining: remaining,
          };
        }
      }

      // 2. Invalidate previous OTPs
      await otpRepository.invalidatePreviousOtps(normalizedPhone);

      // 3. Generate cryptographic 6-digit code
      const code = this.generateOtpCode();
      const salt = crypto.randomBytes(16).toString('hex');
      const codeHash = this.hashOtpCode(code, salt);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // 4. Persist OTP record in database
      await otpRepository.create({
        email: normalizedPhone,
        codeHash,
        salt,
        expiresAt,
        attempts: 0,
        used: false,
        lastSentAt: new Date(),
      });

      // 5. Send/Log SMS in development/testing
      console.log(`[IndoBid OTP] Verification code for ${normalizedPhone}: ${code}`);

      return {
        success: true,
        message: `A 6-digit verification code has been sent to ${normalizedPhone}.`,
        cooldownRemaining: RESEND_COOLDOWN_SECONDS,
      };
    } else {
      // Email validation
      const cleanEmail = cleanTarget.toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }

      // 1. Check 60-second resend cooldown on most recent OTP
      const latestOtp = await otpRepository.findLatestByEmail(cleanEmail);
      if (latestOtp) {
        const secondsSinceLastSent = (Date.now() - new Date(latestOtp.lastSentAt).getTime()) / 1000;
        if (secondsSinceLastSent < RESEND_COOLDOWN_SECONDS) {
          const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLastSent);
          return {
            success: false,
            error: `Please wait ${remaining}s before requesting a new code.`,
            cooldownRemaining: remaining,
          };
        }
      }

      // 2. Invalidate existing unused OTPs
      await otpRepository.invalidatePreviousOtps(cleanEmail);

      // 3. Generate new OTP & cryptographic salt
      const code = this.generateOtpCode();
      const salt = crypto.randomBytes(16).toString('hex');
      const codeHash = this.hashOtpCode(code, salt);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      // 4. Persist OTP record via repository
      await otpRepository.create({
        email: cleanEmail,
        codeHash,
        salt,
        expiresAt,
        attempts: 0,
        used: false,
        lastSentAt: new Date(),
      });

      // 5. Send verification email
      const emailSent = await this.sendOtpEmail(cleanEmail, code);
      if (!emailSent && env.isProduction) {
        return {
          success: false,
          error: 'Failed to dispatch verification email. Please try again later.',
        };
      }

      return {
        success: true,
        message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
        cooldownRemaining: RESEND_COOLDOWN_SECONDS,
      };
    }
  }

  async verifyOtp(
    target: string,
    code: string,
    options?: { username?: string; displayName?: string }
  ): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    const cleanTarget = (target || '').trim();
    const cleanCode = (code || '').trim();

    if (!cleanTarget || !cleanCode) {
      return { success: false, error: 'Target and verification code are required.' };
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      return { success: false, error: 'Verification code must be 6 digits.' };
    }

    const detectedType = detectContactType(cleanTarget);
    const lookupTarget = detectedType === 'phone'
      ? normalizePhoneNumber(cleanTarget)
      : cleanTarget.toLowerCase();

    // 1. Fetch latest unused OTP record
    const otpRecord = await otpRepository.findLatestByEmail(lookupTarget);

    if (!otpRecord) {
      return { success: false, error: 'No active verification code found. Please request a new one.' };
    }

    // 2. Check maximum failed attempts
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      return {
        success: false,
        error: 'Too many failed attempts. This code is invalidated. Please request a new code.',
      };
    }

    // 3. Check expiration
    if (new Date(otpRecord.expiresAt) < new Date()) {
      await otpRepository.markAsUsed(otpRecord.id);
      return { success: false, error: 'Verification code has expired. Please request a new one.' };
    }

    // 4. Verify code with timing-safe comparison
    const computedHash = this.hashOtpCode(cleanCode, otpRecord.salt);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(otpRecord.codeHash, 'hex')
    );

    if (!isValid) {
      const updated = await otpRepository.incrementAttempts(otpRecord.id);
      const remainingAttempts = MAX_OTP_ATTEMPTS - updated.attempts;
      if (remainingAttempts <= 0) {
        return {
          success: false,
          error: 'Too many failed attempts. Code invalidated. Please request a new code.',
        };
      }
      return {
        success: false,
        error: `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`,
      };
    }

    // 5. Mark OTP as used
    await otpRepository.markAsUsed(otpRecord.id);

    // 6. Authoritative User Provisioning / Verification
    let user = await userRepository.findByEmail(lookupTarget);
    if (!user && detectedType === 'phone') {
      const digits = lookupTarget.replace(/\D/g, '');
      user = (await userRepository.findByUsername(lookupTarget)) ||
             (await userRepository.findByUsername(digits));
    }

    const isFounderEmail = lookupTarget === env.ADMIN_EMAIL;

    if (!user) {
      const emailPrefix = detectedType === 'phone'
        ? `user_${lookupTarget.replace(/\D/g, '').slice(-6)}`
        : lookupTarget.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 15);
      const baseUsername = options?.username?.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20) || emailPrefix || 'debater';
      let candidateUsername = isFounderEmail ? 'vishalkumar' : baseUsername;

      // Ensure username uniqueness
      const existingUser = await userRepository.findByUsername(candidateUsername);
      if (existingUser && !isFounderEmail) {
        candidateUsername = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = passwordService.hashPassword(randomPassword);

      user = await userRepository.create({
        email: lookupTarget,
        username: candidateUsername,
        displayName: options?.displayName?.trim() || (isFounderEmail ? 'Vishal Kumar' : candidateUsername),
        passwordHash,
        isVerified: true,
        emailVerifiedAt: new Date(),
        role: isFounderEmail ? 'founder' : 'user',
      });
    } else {
      user = await userRepository.update(user.id, {
        isVerified: true,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
        role: isFounderEmail ? 'founder' : user.role,
      });
    }

    // 7. Issue Session Token
    const userSession = {
      userId: user.id,
      username: user.username || 'user',
      email: user.email,
      displayName: user.displayName || user.username || 'Debater',
      role: user.role,
    };

    const sessionToken = sessionService.createSessionToken(userSession);

    return {
      success: true,
      user: userSession,
      token: sessionToken,
    };
  }

  async verifyEmailOtp(
    email: string,
    code: string,
    options?: { username?: string; displayName?: string }
  ): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
    return this.verifyOtp(email, code, options);
  }
}

export const otpService = new OtpService();
export const generateOtpCode = () => otpService.generateOtpCode();
export const hashOtpCode = (code: string, salt: string) => otpService.hashOtpCode(code, salt);
export const sendOtpEmail = (email: string, code: string) => otpService.sendOtpEmail(email, code);
export const requestOtp = (target: string, explicitType?: 'email' | 'phone') => otpService.requestOtp(target, explicitType);
export const requestEmailOtp = (email: string) => otpService.requestEmailOtp(email);
export const verifyOtp = (
  target: string,
  code: string,
  options?: { username?: string; displayName?: string }
) => otpService.verifyOtp(target, code, options);
export const verifyEmailOtp = (
  email: string,
  code: string,
  options?: { username?: string; displayName?: string }
) => otpService.verifyEmailOtp(email, code, options);
