/**
 * INDOBID — EMAIL OTP REPOSITORY
 * Centralizes database operations for email one-time password verification records.
 */

import { Prisma, EmailOtp } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class OtpRepository {
  async findLatestByEmail(email: string): Promise<EmailOtp | null> {
    const normalized = email.toLowerCase().trim();
    return safeDb(() =>
      prisma.emailOtp.findFirst({
        where: { email: normalized, used: false },
        orderBy: { createdAt: 'desc' },
      })
    );
  }

  async findActiveByEmail(email: string): Promise<EmailOtp | null> {
    const normalized = email.toLowerCase().trim();
    return safeDb(() =>
      prisma.emailOtp.findFirst({
        where: {
          email: normalized,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })
    );
  }

  async create(data: Prisma.EmailOtpCreateInput): Promise<EmailOtp> {
    return safeDb(() => prisma.emailOtp.create({ data }));
  }

  async update(id: string, data: Prisma.EmailOtpUpdateInput): Promise<EmailOtp> {
    return safeDb(() => prisma.emailOtp.update({ where: { id }, data }));
  }

  async invalidatePreviousOtps(email: string): Promise<number> {
    const normalized = email.toLowerCase().trim();
    const result = await safeDb(() =>
      prisma.emailOtp.updateMany({
        where: { email: normalized, used: false },
        data: { used: true },
      })
    );
    return result.count;
  }

  async incrementAttempts(id: string): Promise<EmailOtp> {
    return safeDb(() =>
      prisma.emailOtp.update({
        where: { id },
        data: { attempts: { increment: 1 } },
      })
    );
  }

  async markAsUsed(id: string): Promise<EmailOtp> {
    return safeDb(() =>
      prisma.emailOtp.update({
        where: { id },
        data: { used: true },
      })
    );
  }
}

export const otpRepository = new OtpRepository();
