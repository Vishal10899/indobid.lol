/**
 * INDOBID — CREATOR EARNINGS LEDGER REPOSITORY
 */

import { Prisma, CreatorEarningsLedger } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class LedgerRepository {
  async findByContributionId(contributionId: string): Promise<CreatorEarningsLedger | null> {
    return safeDb(() =>
      prisma.creatorEarningsLedger.findUnique({
        where: { contributionId },
      })
    );
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<CreatorEarningsLedger | null> {
    return safeDb(() =>
      prisma.creatorEarningsLedger.findUnique({
        where: { idempotencyKey },
      })
    );
  }

  async updateByContributionId(
    contributionId: string,
    data: Prisma.CreatorEarningsLedgerUpdateInput
  ): Promise<CreatorEarningsLedger> {
    return safeDb(() =>
      prisma.creatorEarningsLedger.update({
        where: { contributionId },
        data,
      })
    );
  }

  async create(data: Prisma.CreatorEarningsLedgerCreateInput): Promise<CreatorEarningsLedger> {
    return safeDb(() => prisma.creatorEarningsLedger.create({ data }));
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.CreatorEarningsLedgerWhereInput;
    orderBy?: Prisma.CreatorEarningsLedgerOrderByWithRelationInput;
  }): Promise<CreatorEarningsLedger[]> {
    return safeDb(() => prisma.creatorEarningsLedger.findMany(params));
  }

  async aggregateEarnings(creatorUsername: string): Promise<{
    totalEarnedPaise: number;
    pendingPaise: number;
    paidPaise: number;
    count: number;
  }> {
    const entries = await safeDb(() =>
      prisma.creatorEarningsLedger.findMany({
        where: { creatorUsername },
      })
    );

    let totalEarnedPaise = 0;
    let pendingPaise = 0;
    let paidPaise = 0;

    for (const e of entries) {
      totalEarnedPaise += e.creatorRewardPaise;
      if (e.status === 'pending' || e.status === 'eligible') {
        pendingPaise += e.creatorRewardPaise;
      } else if (e.status === 'paid' || e.status === 'settled') {
        paidPaise += e.creatorRewardPaise;
      }
    }

    return {
      totalEarnedPaise,
      pendingPaise,
      paidPaise,
      count: entries.length,
    };
  }
}

export const ledgerRepository = new LedgerRepository();
