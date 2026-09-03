/**
 * INDOBID — PAYOUT ACCOUNT REPOSITORY
 * Centralizes database operations for creator bank accounts and UPI payout methods.
 */

import { Prisma, PayoutAccount } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class PayoutAccountRepository {
  async findByUserId(userId: string): Promise<PayoutAccount | null> {
    return safeDb(() => prisma.payoutAccount.findUnique({ where: { userId } }));
  }

  async upsert(userId: string, data: {
    accountType: string;
    accountHolderName: string;
    maskedAccountNumber: string;
    maskedIfsc?: string | null;
    status?: string;
  }): Promise<PayoutAccount> {
    return safeDb(() =>
      prisma.payoutAccount.upsert({
        where: { userId },
        update: {
          accountType: data.accountType,
          accountHolderName: data.accountHolderName,
          maskedAccountNumber: data.maskedAccountNumber,
          maskedIfsc: data.maskedIfsc,
          status: data.status || 'verified',
          verifiedAt: new Date(),
        },
        create: {
          userId,
          accountType: data.accountType,
          accountHolderName: data.accountHolderName,
          maskedAccountNumber: data.maskedAccountNumber,
          maskedIfsc: data.maskedIfsc,
          status: data.status || 'verified',
          verifiedAt: new Date(),
        },
      })
    );
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    try {
      await safeDb(() => prisma.payoutAccount.delete({ where: { userId } }));
      return true;
    } catch {
      return false;
    }
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PayoutAccountWhereInput;
    orderBy?: Prisma.PayoutAccountOrderByWithRelationInput;
  }): Promise<PayoutAccount[]> {
    return safeDb(() => prisma.payoutAccount.findMany(params));
  }
}

export const payoutAccountRepository = new PayoutAccountRepository();
