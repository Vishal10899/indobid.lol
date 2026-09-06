/**
 * INDOBID — ADMIN REPOSITORY
 * Centralizes administrative data queries, updates, and aggregations.
 */

import { prisma } from '../../infrastructure/database/prisma';
import { safeDb } from '../../infrastructure/database/transactions';

export class AdminRepository {
  async listUsers(skip = 0, take = 50, search?: string) {
    const where: any = {};
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await safeDb(() =>
      Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: {
            _count: {
              select: {
                debates: true,
                contributions: true,
                likes: true,
                followers: true,
                following: true,
              },
            },
          },
        }),
      ])
    );

    return { total, users };
  }

  async updateUser(id: string, data: { isSuspended?: boolean; isVerified?: boolean; role?: string }) {
    return safeDb(() => prisma.user.update({ where: { id }, data }));
  }

  async listDebates(skip = 0, take = 50, status?: string) {
    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const [total, debates] = await safeDb(() =>
      Promise.all([
        prisma.debate.count({ where }),
        prisma.debate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: {
            category: true,
            author: { select: { id: true, username: true, displayName: true, email: true } },
          },
        }),
      ])
    );

    return { total, debates };
  }

  async updateDebate(id: string, data: { status?: string; trendingScore?: number }) {
    return safeDb(() => prisma.debate.update({ where: { id }, data }));
  }

  async deleteDebate(id: string) {
    return safeDb(() => prisma.debate.delete({ where: { id } }));
  }

  async rankDownDebate(id: string, penalty = 50) {
    const debate = await safeDb(() => prisma.debate.findUnique({ where: { id } }));
    if (!debate) throw new Error('Debate not found');
    const newScore = Math.round(((debate.trendingScore || 0) - penalty) * 100) / 100;
    const additionalReports = Math.max(1, Math.ceil(penalty / 30));
    return safeDb(() =>
      prisma.debate.update({
        where: { id },
        data: {
          trendingScore: newScore,
          reportCount: { increment: additionalReports },
        },
      })
    );
  }

  async resetDebateRank(id: string) {
    const debate = await safeDb(() =>
      prisma.debate.findUnique({
        where: { id },
        include: {
          contributions: {
            where: { status: 'verified' },
            select: { amount: true, authorUsername: true, createdAt: true },
          },
        },
      })
    );
    if (!debate) throw new Error('Debate not found');
    const { calculateTrendingScore } = await import('../feed/trending/trending.service');
    const totalVerifiedPaise = debate.totalVerifiedContribution || 0;
    const participants = new Set<string>();
    if (debate.authorUsername) participants.add(debate.authorUsername.toLowerCase());
    for (const c of debate.contributions) {
      if (c.authorUsername) participants.add(c.authorUsername.toLowerCase());
    }

    const naturalScore = calculateTrendingScore({
      totalVerifiedPaise,
      likeCount: debate.likeCount,
      impressionCount: debate.impressionCount,
      contributionCount: debate.contributionCount,
      uniqueParticipants: participants.size,
      lastContributionAt: debate.lastContributionAt,
      createdAt: debate.createdAt,
      reportCount: 0,
    });

    return safeDb(() =>
      prisma.debate.update({
        where: { id },
        data: {
          trendingScore: naturalScore,
          reportCount: 0,
        },
      })
    );
  }


  async listPayments(skip = 0, take = 50, status?: string) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [total, payments] = await safeDb(() =>
      Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: {
            debate: { select: { id: true, title: true, authorUsername: true } },
            contribution: { select: { id: true, sequence: true, content: true, authorUsername: true } },
          },
        }),
      ])
    );

    return { total, payments };
  }
}

export const adminRepository = new AdminRepository();
