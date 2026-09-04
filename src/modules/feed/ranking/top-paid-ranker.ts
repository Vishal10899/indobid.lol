/**
 * INDOBID — TOP PAID RANKER
 * Canonical ranking for paid post priority.
 *
 * Core Invariants:
 * 1. Paid posts appear strictly above unpaid posts.
 * 2. Among paid posts: higher backing/contribution amount = higher ranking priority.
 *    e.g. $25 (2500 paise) > $5 (500 paise) > $0.50 (50 paise) > unpaid ($0).
 * 3. Only canonical successful/confirmed payments from the database determine ranking.
 * 4. Failed, cancelled, pending, or refunded payments NEVER increase ranking.
 * 5. Frontend-supplied ranking values are completely ignored.
 * 6. Ties broken by lastContributionAt DESC, then createdAt DESC.
 * 7. Ghost Mode identities are strictly masked via resolveAuthorIdentity.
 */

import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';
import { mapDebateToListItem } from '../feed.mapper';
import { DebateListItem } from '../../debates/debate.types';

export interface TopPaidQueryOptions {
  category?: string;
  page?: number;
  limit?: number;
  paidOnly?: boolean; // if true, only returns posts with totalVerifiedContribution > 0
  currentUserId?: string | null;
}

export interface TopPaidResult {
  items: DebateListItem[];
  debates: DebateListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TopPaidRanker {
  /**
   * Query posts ranked by canonical confirmed backing amount.
   * Paid posts appear above unpaid posts, ordered by totalVerifiedContribution DESC.
   */
  async getTopPaidDebates(options: TopPaidQueryOptions = {}): Promise<TopPaidResult> {
    const {
      category = 'all',
      page = 1,
      limit = 20,
      paidOnly = false,
      currentUserId = null,
    } = options;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where: any = {
      status: 'active',
    };

    if (paidOnly) {
      where.totalVerifiedContribution = { gt: 0 };
    }

    if (
      category &&
      category.toLowerCase() !== 'all' &&
      category.toLowerCase() !== 'for_you' &&
      category.toLowerCase() !== 'following'
    ) {
      where.category = {
        slug: category.toLowerCase().trim(),
      };
    }

    // High performance indexed query:
    // Sort by totalVerifiedContribution DESC, lastContributionAt DESC, createdAt DESC
    const [total, debates] = await safeDb(() =>
      Promise.all([
        prisma.debate.count({ where }),
        prisma.debate.findMany({
          where,
          orderBy: [
            { totalVerifiedContribution: 'desc' },
            { lastContributionAt: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: safeLimit,
          include: {
            category: {
              select: { id: true, name: true, slug: true, icon: true },
            },
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isVerified: true,
                role: true,
                isPrivate: true,
                ghostMode: true,
                ghostDisplayName: true,
              },
            },
          },
        }),
      ])
    );

    const items = debates.map((d) => mapDebateToListItem(d, { currentUserId }));

    return {
      items,
      debates: items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Recalculates and updates a debate's totalVerifiedContribution strictly from
   * confirmed/succeeded payments in the database.
   * Guarantees that refunded, failed, or canceled payments are excluded.
   */
  async verifyAndSyncPaymentTotals(debateId: string): Promise<number> {
    const verifiedSum = await safeDb(() =>
      prisma.payment.aggregate({
        where: {
          debateId,
          status: 'succeeded',
        },
        _sum: {
          amount: true,
        },
      })
    );

    const canonicalTotal = verifiedSum._sum.amount || 0;

    await safeDb(() =>
      prisma.debate.update({
        where: { id: debateId },
        data: {
          totalVerifiedContribution: canonicalTotal,
        },
      })
    );

    return canonicalTotal;
  }
}

export const topPaidRanker = new TopPaidRanker();
