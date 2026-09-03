/**
 * INDOBID — AUTHENTICATION SERVICE
 */

import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { hashPassword, verifyPassword } from '../../lib/security/password';
import { createSessionToken } from '../../lib/security/session';
import { isFounderEmail, verifyAdminSecret, checkAdminLoginRateLimit, recordAdminLoginAttempt } from '../../lib/security/admin';
import { resendEmailProvider } from '../../infrastructure/email/resend.email';
import { prisma } from '../../infrastructure/database/prisma';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  ValidationError,
} from '../../lib/errors';
import { SignupDTO, LoginDTO, AdminLoginDTO } from './auth.types';
import crypto from 'crypto';

export class AuthService {
  async signup(dto: SignupDTO) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.toLowerCase().trim();

    const existingEmail = await userRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    const existingUsername = await userRepository.findByUsername(normalizedUsername);
    if (existingUsername) {
      throw new ConflictError('This username is already taken');
    }

    const { hash, salt } = hashPassword(dto.password);
    const isFounder = isFounderEmail(normalizedEmail);

    const user = await userRepository.create({
      email: normalizedEmail,
      username: normalizedUsername,
      displayName: dto.displayName?.trim() || dto.username.trim(),
      passwordHash: `${salt}:${hash}`,
      role: isFounder ? 'founder' : 'user',
      isVerified: isFounder,
      emailVerifiedAt: isFounder ? new Date() : null,
    });

    // Generate initial OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpSalt = crypto.randomBytes(16).toString('hex');
    const otpHash = crypto.pbkdf2Sync(otpCode, otpSalt, 1000, 32, 'sha256').toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        codeHash: otpHash,
        salt: otpSalt,
        expiresAt,
      },
    });

    await resendEmailProvider.sendEmail({
      to: normalizedEmail,
      subject: 'Verify your IndoBid Account',
      html: `<p>Your verification code is: <strong>${otpCode}</strong>. Valid for 10 minutes.</p>`,
    });

    return {
      userId: user.id,
      email: user.email || normalizedEmail,
      username: user.username || normalizedUsername,
      requiresEmailVerification: !isFounder,
    };
  }

  async login(dto: LoginDTO) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user || !user.passwordHash || !user.email || !user.username) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.isSuspended) {
      throw new AuthorizationError('This account has been suspended by administration');
    }

    const isMatch = verifyPassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      return {
        requiresEmailVerification: true,
        email: user.email,
      };
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isVerified: user.isVerified,
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isVerified: user.isVerified,
      },
    };
  }

  async adminLogin(dto: AdminLoginDTO, ip: string) {
    const rateCheck = checkAdminLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      throw new RateLimitError(`Admin login locked. Please wait ${rateCheck.remainingSeconds} seconds.`);
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    const isFounder = isFounderEmail(normalizedEmail);
    const isSecretValid = verifyAdminSecret(dto.secretKey);

    if (!isFounder || !isSecretValid) {
      recordAdminLoginAttempt(ip, false);
      throw new AuthenticationError('Invalid admin credentials');
    }

    recordAdminLoginAttempt(ip, true);

    const token = createSessionToken({
      userId: 'admin_session',
      email: normalizedEmail,
      username: 'admin',
      role: 'founder',
      isVerified: true,
    });

    return {
      success: true,
      token,
      email: normalizedEmail,
      role: 'founder',
    };
  }

  async verifyOtp(email: string, otp: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const records = await prisma.emailOtp.findMany({
      where: {
        email: normalizedEmail,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    let matchedRecord = null;
    for (const record of records) {
      const derived = crypto.pbkdf2Sync(otp.trim(), record.salt, 1000, 32, 'sha256').toString('hex');
      if (derived === record.codeHash) {
        matchedRecord = record;
        break;
      }
    }

    if (!matchedRecord) {
      throw new ValidationError('Invalid or expired verification code');
    }

    await prisma.user.updateMany({
      where: { email: normalizedEmail },
      data: { emailVerifiedAt: new Date() },
    });

    await prisma.emailOtp.update({
      where: { id: matchedRecord.id },
      data: { used: true },
    });

    return { success: true, message: 'Email verified successfully' };
  }
}

export const authService = new AuthService();
