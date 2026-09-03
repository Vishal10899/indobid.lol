/**
 * INDOBID — AUTHENTICATION SERVICE
 * Authoritative signup, login, session token creation, and admin authorization.
 */

import { authRepository } from './auth.repository';
import { passwordService } from './password.service';
import { sessionService } from './session.service';
import { otpService } from './otp.service';
import {
  isFounder,
  isAuthorizedAdmin,
  checkAdminLoginRateLimit,
  recordFailedAdminLogin,
  clearAdminLoginRateLimit,
  normalizeEmail,
  ADMIN_EMAIL,
} from './authorization';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  ValidationError,
} from '../../lib/errors';
import { SignupDTO, LoginDTO, AdminLoginDTO } from './auth.types';
import { env } from '../../config/env';

export class AuthService {
  async signup(dto: SignupDTO) {
    const normalizedEmail = normalizeEmail(dto.email);
    const normalizedUsername = dto.username.toLowerCase().trim();

    const existingEmail = await authRepository.findUserByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictError('An account with this email already exists');
    }

    const existingUsername = await authRepository.findUserByUsername(normalizedUsername);
    if (existingUsername) {
      throw new ConflictError('This username is already taken');
    }

    const passwordHash = passwordService.hashPassword(dto.password);
    const isFounderAccount = normalizedEmail === env.ADMIN_EMAIL;

    const user = await authRepository.createUser({
      email: normalizedEmail,
      username: normalizedUsername,
      displayName: dto.displayName?.trim() || dto.username.trim(),
      passwordHash,
      role: isFounderAccount ? 'founder' : 'user',
      isVerified: isFounderAccount,
      emailVerifiedAt: isFounderAccount ? new Date() : null,
    });

    if (!isFounderAccount) {
      // Send initial email OTP
      await otpService.requestEmailOtp(normalizedEmail);
    }

    return {
      userId: user.id,
      email: user.email || normalizedEmail,
      username: user.username || normalizedUsername,
      requiresEmailVerification: !isFounderAccount,
    };
  }

  async login(dto: LoginDTO) {
    const normalizedEmail = normalizeEmail(dto.email);
    const user = await authRepository.findUserByEmail(normalizedEmail);

    if (!user || !user.passwordHash || !user.email || !user.username) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.isSuspended) {
      throw new AuthorizationError('This account has been suspended by administration');
    }

    const isMatch = passwordService.verifyPassword(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.emailVerifiedAt && user.role !== 'founder') {
      return {
        requiresEmailVerification: true,
        email: user.email,
        token: undefined,
        user: undefined,
      };
    }

    const sessionPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName || user.username,
      role: user.role,
    };

    const token = sessionService.createSessionToken(sessionPayload);

    return {
      requiresEmailVerification: false,
      token,
      user: sessionPayload,
    };
  }

  async adminLogin(dto: AdminLoginDTO, ip: string) {
    const rateLimit = checkAdminLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      throw new RateLimitError(
        `Too many failed attempts. Try again in ${rateLimit.retryAfterSeconds}s.`
      );
    }

    const normalizedEmail = normalizeEmail(dto.email);
    const trimmedSecret = dto.secretKey.trim();

    const expectedEmail = env.ADMIN_EMAIL;
    const expectedSecret = env.ADMIN_SECRET_KEY;

    if (!expectedSecret) {
      throw new AuthorizationError('Admin authentication not configured on server');
    }

    const emailMatches = normalizedEmail === expectedEmail;
    const secretMatches =
      trimmedSecret.length === expectedSecret.length &&
      require('crypto').timingSafeEqual(
        Buffer.from(trimmedSecret),
        Buffer.from(expectedSecret)
      );

    if (!emailMatches || !secretMatches) {
      recordFailedAdminLogin(ip);
      throw new AuthorizationError('Invalid admin email or secret key');
    }

    clearAdminLoginRateLimit(ip);
    const token = sessionService.createAdminSessionToken(expectedEmail);

    return { token, email: expectedEmail };
  }
}

export const authService = new AuthService();
