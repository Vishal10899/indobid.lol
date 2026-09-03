/**
 * INDOBID — VISITOR REPOSITORY
 * Centralizes database operations for live visitor tracking and heartbeats.
 */

import { VisitorSession, ListingVisit } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class VisitorRepository {
  async recordHeartbeat(sessionToken: string, ipHash: string, userAgent?: string): Promise<VisitorSession> {
    return safeDb(() =>
      prisma.visitorSession.upsert({
        where: { sessionToken },
        update: {
          lastHeartbeatAt: new Date(),
          pageViews: { increment: 1 },
        },
        create: {
          sessionToken,
          ipHash,
          userAgent: userAgent ? userAgent.substring(0, 300) : null,
          firstSeenAt: new Date(),
          lastHeartbeatAt: new Date(),
          pageViews: 1,
        },
      })
    );
  }

  async countActiveVisitors(windowMinutes = 5): Promise<number> {
    const activeThreshold = new Date(Date.now() - windowMinutes * 60 * 1000);
    return safeDb(() =>
      prisma.visitorSession.count({
        where: { lastHeartbeatAt: { gte: activeThreshold } },
      })
    );
  }

  async countTotalVisitors(): Promise<number> {
    return safeDb(() => prisma.visitorSession.count());
  }

  async countVisitorsSince(since: Date): Promise<number> {
    return safeDb(() =>
      prisma.visitorSession.count({
        where: { firstSeenAt: { gte: since } },
      })
    );
  }

  async recordListingVisit(listingId: string, sessionToken: string): Promise<ListingVisit | null> {
    try {
      const visit = await safeDb(() =>
        prisma.listingVisit.upsert({
          where: { listingId_sessionToken: { listingId, sessionToken } },
          update: {},
          create: { listingId, sessionToken },
        })
      );
      await safeDb(() =>
        prisma.listing.update({
          where: { id: listingId },
          data: { visitCount: { increment: 1 } },
        })
      );
      return visit;
    } catch {
      return null;
    }
  }
}

export const visitorRepository = new VisitorRepository();
