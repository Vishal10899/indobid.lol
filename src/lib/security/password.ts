/**
 * INDOBID — PASSWORD CRYPTOGRAPHY
 * Uses PBKDF2-SHA512 with 100k rounds and 32-byte salts.
 */

import crypto from 'crypto';
import { securityConfig } from '../../config/security';

export interface PasswordHashResult {
  hash: string;
  salt: string;
}

export function hashPassword(password: string): PasswordHashResult {
  const salt = crypto.randomBytes(securityConfig.password.SALT_BYTES).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    securityConfig.password.ITERATIONS,
    securityConfig.password.KEYLEN,
    securityConfig.password.DIGEST
  );
  return { hash: derivedKey.toString('hex'), salt };
}

export function verifyPassword(password: string, storedHash: string, salt?: string): boolean {
  if (!storedHash || !password) return false;

  // Stored with salt in single string format "salt:hash"
  if (storedHash.includes(':') && !salt) {
    const [extractedSalt, extractedHash] = storedHash.split(':');
    const derivedKey = crypto.pbkdf2Sync(
      password,
      extractedSalt,
      securityConfig.password.ITERATIONS,
      securityConfig.password.KEYLEN,
      securityConfig.password.DIGEST
    );
    return crypto.timingSafeEqual(
      Buffer.from(derivedKey.toString('hex')),
      Buffer.from(extractedHash)
    );
  }

  // Stored with separate salt parameter
  if (salt) {
    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      securityConfig.password.ITERATIONS,
      securityConfig.password.KEYLEN,
      securityConfig.password.DIGEST
    );
    const keyHex = derivedKey.toString('hex');
    if (keyHex.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(keyHex), Buffer.from(storedHash));
  }

  return false;
}
