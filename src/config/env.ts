/**
 * INDOBID — CENTRALIZED ENVIRONMENT CONFIGURATION
 * Validates, normalizes, and provides single source of truth for all environment variables.
 */

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Server Authentication & Security
  AUTH_SECRET: process.env.AUTH_SECRET || 'indobid_social_jwt_secret_94884210',
  ADMIN_EMAIL: normalizeEmail(process.env.ADMIN_EMAIL || 'vishalkumar75912@gmail.com'),
  ADMIN_SECRET_KEY: (process.env.ADMIN_SECRET_KEY || '').trim(),

  // Payment Gateway (Razorpay)
  RAZORPAY_KEY_ID: (process.env.RAZORPAY_KEY_ID || '').trim(),
  RAZORPAY_KEY_SECRET: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
  RAZORPAY_WEBHOOK_SECRET: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),

  // Transactional Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'IndoBid <noreply@indobid.lol>',

  // Application Domain
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://indobid.lol',

  // Runtime Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
} as const;

export type EnvConfig = typeof env;
