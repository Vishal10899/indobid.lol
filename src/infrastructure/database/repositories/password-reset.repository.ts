/**
 * INDOBID — PASSWORD RESET TOKEN REPOSITORY
 * Centralizes database operations for password reset tokens.
 */

import { Prisma, PasswordResetToken } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class PasswordResetRepository {
  async findLatestByEmail(email: string): Promise<PasswordResetToken | null> {
    const normalized = email.toLowerCase().trim();
    return safeDb(() =>
      prisma.passwordResetToken.findFirst({
        where: { email: normalized, used: false },
        orderBy: { createdAt: 'desc' },
      })
    );
  }

  async findActiveByEmail(email: string): Promise<PasswordResetToken | null> {
    const normalized = email.toLowerCase().trim();
    return safeDb(() =>
      prisma.passwordResetToken.findFirst({
        where: {
          email: normalized,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })
    );
  }

  async create(data: Prisma.PasswordResetTokenCreateInput): Promise<PasswordResetToken> {
    return safeDb(() => prisma.passwordResetToken.create({ data }));
  }

  async invalidatePreviousTokens(email: string): Promise<number> {
    const normalized = email.toLowerCase().trim();
    const result = await safeDb(() =>
      prisma.passwordResetToken.updateMany({
        where: { email: normalized, used: false },
        data: { used: true },
      })
    );
    return result.count;
  }

  async markAsUsed(id: string): Promise<PasswordResetToken> {
    return safeDb(() =>
      prisma.passwordResetToken.update({
        where: { id },
        data: { used: true },
      })
    );
  }
}

export const passwordResetRepository = new PasswordResetRepository();
