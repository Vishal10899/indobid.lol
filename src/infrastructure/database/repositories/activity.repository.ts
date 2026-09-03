/**
 * INDOBID — DEBATE ACTIVITY EVENT REPOSITORY
 * Centralizes database operations for live ticker and debate activity feeds.
 */

import { Prisma, DebateActivityEvent } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class ActivityRepository {
  async findRecent(limit = 20): Promise<DebateActivityEvent[]> {
    return safeDb(() =>
      prisma.debateActivityEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    );
  }

  async findByDebateId(debateId: string, limit = 20): Promise<DebateActivityEvent[]> {
    return safeDb(() =>
      prisma.debateActivityEvent.findMany({
        where: { debateId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
    );
  }

  async create(data: Prisma.DebateActivityEventCreateInput): Promise<DebateActivityEvent> {
    return safeDb(() => prisma.debateActivityEvent.create({ data }));
  }
}

export const activityRepository = new ActivityRepository();
