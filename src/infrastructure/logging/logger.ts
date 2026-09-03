/**
 * INDOBID — STRUCTURED LOGGER
 * Sanitizes logs to guarantee zero secret, password, OTP, or token leakage.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'otp',
  'secret',
  'adminSecretKey',
  'authSecret',
  'razorpayKeySecret',
  'razorpayWebhookSecret',
  'resendApiKey',
  'databaseUrl',
  'signature',
]);

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEYS.has(key)) {
      sanitized[key] = '********';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  info(message: string, meta?: Record<string, any>): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? sanitizeData(meta) : '');
  },

  warn(message: string, meta?: Record<string, any>): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? sanitizeData(meta) : '');
  },

  error(message: string, error?: any, meta?: Record<string, any>): void {
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(
      `[ERROR] ${new Date().toISOString()} - ${message}`,
      errorDetails,
      meta ? sanitizeData(meta) : ''
    );
  },

  debug(message: string, meta?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta ? sanitizeData(meta) : '');
    }
  },
};
