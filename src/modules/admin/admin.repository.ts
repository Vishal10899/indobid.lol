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

  async updateDebate(id: string, data: { status?: string }) {
    return safeDb(() => prisma.debate.update({ where: { id }, data }));
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
