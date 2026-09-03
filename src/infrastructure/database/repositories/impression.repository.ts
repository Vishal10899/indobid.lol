/**
 * INDOBID — DEBATE IMPRESSION REPOSITORY
 * Centralizes database operations for tracking unique debate impressions.
 */

import { Prisma, DebateImpression } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class ImpressionRepository {
  async findUnique(debateId: string, sessionToken: string): Promise<DebateImpression | null> {
    return safeDb(() =>
      prisma.debateImpression.findUnique({
        where: {
          debateId_sessionToken: {
            debateId,
            sessionToken,
          },
        },
      })
    );
  }

  async recordImpression(debateId: string, sessionToken: string): Promise<{ recorded: boolean }> {
    try {
      await safeDb(() =>
        prisma.debateImpression.create({
          data: {
            debate: { connect: { id: debateId } },
            sessionToken,
          },
        })
      );
      // Increment debate impression count atomically
      await safeDb(() =>
        prisma.debate.update({
          where: { id: debateId },
          data: { impressionCount: { increment: 1 } },
        })
      );
      return { recorded: true };
    } catch {
      // Duplicate impression in same session is ignored idempotently
      return { recorded: false };
    }
  }

  async countByDebateId(debateId: string): Promise<number> {
    return safeDb(() => prisma.debateImpression.count({ where: { debateId } }));
  }
}

export const impressionRepository = new ImpressionRepository();
