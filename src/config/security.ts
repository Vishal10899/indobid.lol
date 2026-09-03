/**
 * INDOBID — SECURITY & CRYPTOGRAPHY CONFIGURATION
 * Single source of truth for cryptographic parameters, session timeouts, and rate limits.
 */

export const securityConfig = {
  // Password Cryptography (PBKDF2)
  password: {
    ITERATIONS: 100000,
    KEYLEN: 64,
    DIGEST: 'sha512' as const,
    SALT_BYTES: 32,
    MIN_LENGTH: 8,
  },

  // Sessions & Cookies
  session: {
    COOKIE_NAME: 'indobid_session',
    ADMIN_COOKIE_NAME: 'indobid_admin_session',
    MAX_AGE_SECONDS: 30 * 24 * 60 * 60, // 30 days
    ADMIN_MAX_AGE_SECONDS: 24 * 60 * 60, // 24 hours
    SAME_SITE: 'lax' as const,
  },

  // Email OTP
  otp: {
    LENGTH: 6,
    EXPIRY_MINUTES: 10,
    COOLDOWN_SECONDS: 60,
    MAX_ATTEMPTS: 5,
  },

  // Password Reset
  passwordReset: {
    TOKEN_BYTES: 32,
    EXPIRY_HOURS: 1,
  },

  // Rate Limiting Sliding Windows
  rateLimits: {
    LOGIN: { limit: 15, windowMs: 60 * 1000 },
    SIGNUP: { limit: 10, windowMs: 60 * 1000 },
    OTP: { limit: 10, windowMs: 60 * 1000 },
    DEBATES: { limit: 30, windowMs: 60 * 1000 },
    ADMIN_LOGIN: { limit: 5, windowMs: 15 * 60 * 1000 }, // 15-min lockout after 5 fails
  },
} as const;

export type SecurityConfig = typeof securityConfig;
