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
  countryCode: z.string().min(2).max(2).toUpperCase().optional(),
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

/**
 * Detects whether an input string is an email address or a phone number.
 */
export function detectContactType(input: string): 'email' | 'phone' | 'invalid' {
  const trimmed = input.trim();
  if (!trimmed) return 'invalid';

  // If it contains '@', it's an email attempt
  if (trimmed.includes('@')) {
    return 'email';
  }

  // If it has any alphabetic letters, treat as email attempt
  if (/[a-zA-Z]/.test(trimmed)) {
    return 'email';
  }

  // If it consists of digits, spaces, dashes, parentheses, or a leading plus
  if (/^\+?[\d\s\-()]+$/.test(trimmed)) {
    return 'phone';
  }

  return 'invalid';
}

/**
 * Validates an email address.
 */
export function isValidEmail(email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail);
}

/**
 * Normalizes a phone number to standard format (+[countryCode][number]).
 * For 10-digit numbers (like Indian mobile 7409675912), defaults to +91.
 */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  // 10 digits -> default Indian mobile +91
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  // 12 digits starting with 91 -> +91...
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  // 11 digits starting with 0 -> +91...
  if (/^0\d{10}$/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Validates a normalized or raw phone number.
 * Must have between 10 and 15 digits.
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

