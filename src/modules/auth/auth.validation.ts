/**
 * INDOBID — AUTHENTICATION VALIDATION
 */

import { z } from 'zod';
import { securityConfig } from '../../config/security';

export const SignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  displayName: z.string().min(1).max(50).optional(),
  password: z
    .string()
    .min(securityConfig.password.MIN_LENGTH, `Password must be at least ${securityConfig.password.MIN_LENGTH} characters`),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const OtpVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(securityConfig.password.MIN_LENGTH, `Password must be at least ${securityConfig.password.MIN_LENGTH} characters`),
});
