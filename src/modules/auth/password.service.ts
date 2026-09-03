/**
 * INDOBID — PASSWORD SECURITY SERVICE
 * Cryptographic password hashing and timing-safe verification using PBKDF2-SHA512.
 */

import crypto from 'crypto';

export class PasswordService {
  /**
   * Hashes a plain-text password with a unique 16-byte cryptographically secure salt.
   * Format: <salt>:<hash>
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Timing-safe verification of a plain-text password against a stored <salt>:<hash> string.
   */
  verifyPassword(password: string, storedHash: string): boolean {
    try {
      const [salt, originalHash] = storedHash.split(':');
      if (!salt || !originalHash) return false;
      const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
    } catch {
      return false;
    }
  }
}

export const passwordService = new PasswordService();
export const hashPassword = (password: string) => passwordService.hashPassword(password);
export const verifyPassword = (password: string, storedHash: string) =>
  passwordService.verifyPassword(password, storedHash);
