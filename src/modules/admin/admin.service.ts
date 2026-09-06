/**
 * INDOBID — ADMIN SERVICE
 * Centralizes administrative capabilities, statistics aggregation, and platform management.
 */

import { prisma } from '../../infrastructure/database/prisma';
import { safeDb } from '../../infrastructure/database/transactions';
import { adminRepository } from './admin.repository';
import { getAdminVisitorAnalytics } from '../../lib/visitor-tracker';
import { AdminDebateUpdateDTO, AdminStatsMetrics, AdminUserUpdateDTO } from './admin.types';

export class AdminService {
  async getStatsMetrics(): Promise<AdminStatsMetrics> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Debates counts
    const [
      totalDebates,
      activeDebates,
      pendingPaymentDebates,
      hiddenDebates,
      removedDebates,
    ] = await safeDb(() =>
      Promise.all([
        prisma.debate.count(),
        prisma.debate.count({ where: { status: 'active' } }),
        prisma.debate.count({ where: { status: 'pending_payment' } }),
        prisma.debate.count({ where: { status: 'hidden' } }),
        prisma.debate.count({ where: { status: 'removed' } }),
      ])
    );

    // 2. Contributions counts
    const [
      totalContributions,
      verifiedContributions,
      pendingContributions,
      failedContributions,
      canceledContributions,
    ] = await safeDb(() =>
      Promise.all([
        prisma.contribution.count(),
        prisma.contribution.count({ where: { status: 'verified' } }),
        prisma.contribution.count({ where: { status: 'pending_payment' } }),
        prisma.contribution.count({ where: { status: 'failed' } }),
        prisma.contribution.count({ where: { status: 'canceled' } }),
      ])
    );

    // 3. Real Verified Revenue (EXCLUSIVELY from Payment records with status: 'succeeded')
    const [totalRevAgg, todayRevAgg, weekRevAgg, monthRevAgg] = await safeDb(() =>
      Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'succeeded' },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'succeeded', createdAt: { gte: startOfToday } },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'succeeded', createdAt: { gte: startOfWeek } },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'succeeded', createdAt: { gte: startOfMonth } },
        }),
      ])
    );

    const totalRevenuePaise = totalRevAgg._sum.amount || 0;
    const todayRevenuePaise = todayRevAgg._sum.amount || 0;
    const weekRevenuePaise = weekRevAgg._sum.amount || 0;
    const monthRevenuePaise = monthRevAgg._sum.amount || 0;

    // 4. Payments breakdown
    const [
      totalPayments,
      successfulPayments,
      failedPayments,
      canceledPayments,
      pendingPayments,
    ] = await safeDb(() =>
      Promise.all([
        prisma.payment.count(),
        prisma.payment.count({ where: { status: 'succeeded' } }),
        prisma.payment.count({ where: { status: 'failed' } }),
        prisma.payment.count({ where: { status: 'canceled' } }),
        prisma.payment.count({ where: { status: 'pending' } }),
      ])
    );

    // 5. Total Users, Today's New Users/Posts & Reports
    const [
      totalUsers,
      todayNewUsers,
      todayNewPosts,
      creatorRewardsAgg,
      pendingReportsCount,
      visitorAnalytics,
    ] = await safeDb(() =>
      Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.debate.count({ where: { status: 'active', createdAt: { gte: startOfToday } } }),
        prisma.creatorEarningsLedger.aggregate({
          _sum: { creatorRewardPaise: true },
          where: { status: { in: ['pending', 'available', 'paid'] } },
        }),
        prisma.debateReport.count({ where: { status: 'pending' } }),
        getAdminVisitorAnalytics(5),
      ])
    );

    const totalCreatorRewardsPaise = creatorRewardsAgg._sum?.creatorRewardPaise || 0;

    // 6. Top Debates
    const [topSupportedDebates, mostActiveDebates, topTrendingDebates] = await safeDb(() =>
      Promise.all([
        prisma.debate.findMany({
          where: { status: 'active' },
          orderBy: { totalVerifiedContribution: 'desc' },
          take: 5,
          include: { category: { select: { name: true } } },
        }),
        prisma.debate.findMany({
          where: { status: 'active' },
          orderBy: { contributionCount: 'desc' },
          take: 5,
          include: { category: { select: { name: true } } },
        }),
        prisma.debate.findMany({
          where: { status: 'active' },
          orderBy: { trendingScore: 'desc' },
          take: 5,
          include: { category: { select: { name: true } } },
        }),
      ])
    );

    return {
      debates: {
        total: totalDebates,
        active: activeDebates,
        todayNew: todayNewPosts,
        pendingPayment: pendingPaymentDebates,
        hidden: hiddenDebates,
        removed: removedDebates,
      },
      contributions: {
        total: totalContributions,
        verified: verifiedContributions,
        pending: pendingContributions,
        failed: failedContributions,
        canceled: canceledContributions,
      },
      financials: {
        currency: 'INR',
        totalRevenuePaise,
        totalRevenueRupees: totalRevenuePaise / 100,
        todayRevenueRupees: todayRevenuePaise / 100,
        weekRevenueRupees: weekRevenuePaise / 100,
        monthRevenueRupees: monthRevenuePaise / 100,
        totalCreatorRewardsPaise,
        totalCreatorRewardsRupees: totalCreatorRewardsPaise / 100,
      },
      payments: {
        total: totalPayments,
        successful: successfulPayments,
        failed: failedPayments,
        canceled: canceledPayments,
        pending: pendingPayments,
      },
      users: {
        total: totalUsers,
        todayNew: todayNewUsers,
      },
      moderation: {
        pendingReports: pendingReportsCount,
      },
      visitors: visitorAnalytics,
      rankings: {
        topSupported: topSupportedDebates,
        mostActive: mostActiveDebates,
        topTrending: topTrendingDebates,
      },
    };
  }

  async listPayments(skip = 0, take = 50, status?: string) {
    return adminRepository.listPayments(skip, take, status);
  }

  async listUsers(skip = 0, take = 50, search?: string) {
    return adminRepository.listUsers(skip, take, search);
  }

  async updateUser(id: string, dto: AdminUserUpdateDTO) {
    return adminRepository.updateUser(id, dto);
  }

  async moderateUser(id: string, dto: AdminUserUpdateDTO) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }

    const { ADMIN_EMAIL } = await import('../auth/authorization');
    if (
      dto.isSuspended &&
      (user.role === 'founder' || (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()))
    ) {
      throw new Error('Cannot suspend the Founder account');
    }

    return adminRepository.updateUser(id, {
      isSuspended: dto.isSuspended !== undefined ? Boolean(dto.isSuspended) : undefined,
      isVerified: dto.isVerified !== undefined ? Boolean(dto.isVerified) : undefined,
      role: dto.role,
    });
  }

  async listDebates(skip = 0, take = 50, status?: string) {
    return adminRepository.listDebates(skip, take, status);
  }

  async updateDebate(id: string, dto: AdminDebateUpdateDTO) {
    return adminRepository.updateDebate(id, dto);
  }

  async deleteDebate(id: string) {
    const debate = await prisma.debate.findUnique({ where: { id } });
    if (!debate) {
      throw new Error('Debate not found');
    }
    return adminRepository.deleteDebate(id);
  }

  async rankDownDebate(id: string, penalty = 50) {
    const debate = await prisma.debate.findUnique({ where: { id } });
    if (!debate) {
      throw new Error('Debate not found');
    }
    return adminRepository.rankDownDebate(id, penalty);
  }

  async resetDebateRank(id: string) {
    const debate = await prisma.debate.findUnique({ where: { id } });
    if (!debate) {
      throw new Error('Debate not found');
    }
    return adminRepository.resetDebateRank(id);
  }


  async createFounderDebate(data: {
    title: string;
    content: string;
    categorySlug?: string;
    categoryId?: string;
    hashtags?: string;
    isAnonymous?: boolean;
  }) {
    let category: any = null;
    if (data.categoryId) {
      category = await safeDb(() => prisma.category.findUnique({ where: { id: data.categoryId } }));
    } else if (data.categorySlug) {
      category = await safeDb(() =>
        prisma.category.findFirst({ where: { slug: data.categorySlug!.toLowerCase().trim() } })
      );
    }
    if (!category) {
      category = await safeDb(() => prisma.category.findFirst({ orderBy: { sortOrder: 'asc' } }));
    }
    if (!category) {
      throw new Error('Category not found');
    }

    const { getOrCreateFounderUser } = await import('../auth/authorization');
    const founderUser = await getOrCreateFounderUser();
    const isAnon = Boolean(data.isAnonymous);
    const authorUsername = isAnon ? 'anonymous' : founderUser.username || 'vishalchaudhary';
    const authorDisplayName = isAnon ? 'Anonymous' : founderUser.displayName || 'Vishal Chaudhary';

    return safeDb(() =>
      prisma.debate.create({
        data: {
          authorId: founderUser.id,
          title: data.title.trim(),
          content: data.content.trim(),
          categoryId: category.id,
          authorUsername,
          authorDisplayName,
          isAnonymous: isAnon,
          hashtags: data.hashtags ? data.hashtags.trim() : null,
          originalContribution: 0,
          totalVerifiedContribution: 0,
          contributionCount: 0,
          lastContributionAmount: 0,
          status: 'active',
          trendingScore: 10.0,
        },
        include: { category: true },
      })
    );
  }
}

export const adminService = new AdminService();
