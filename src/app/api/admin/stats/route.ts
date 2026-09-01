import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/auth';
import { getAdminVisitorAnalytics } from '@/lib/visitor-tracker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
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
    ] = await Promise.all([
      prisma.debate.count(),
      prisma.debate.count({ where: { status: 'active' } }),
      prisma.debate.count({ where: { status: 'pending_payment' } }),
      prisma.debate.count({ where: { status: 'hidden' } }),
      prisma.debate.count({ where: { status: 'removed' } }),
    ]);

    // 2. Contributions counts
    const [
      totalContributions,
      verifiedContributions,
      pendingContributions,
      failedContributions,
      canceledContributions,
    ] = await Promise.all([
      prisma.contribution.count(),
      prisma.contribution.count({ where: { status: 'verified' } }),
      prisma.contribution.count({ where: { status: 'pending_payment' } }),
      prisma.contribution.count({ where: { status: 'failed' } }),
      prisma.contribution.count({ where: { status: 'canceled' } }),
    ]);

    // 3. Real Verified Revenue (EXCLUSIVELY from Payment records with status: 'succeeded')
    const [totalRevAgg, todayRevAgg, weekRevAgg, monthRevAgg] = await Promise.all([
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
    ]);

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
    ] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'succeeded' } }),
      prisma.payment.count({ where: { status: 'failed' } }),
      prisma.payment.count({ where: { status: 'canceled' } }),
      prisma.payment.count({ where: { status: 'pending' } }),
    ]);

    // 5. Total Users, Today's New Users/Posts & Reports
    const [
      totalUsers,
      todayNewUsers,
      todayNewPosts,
      creatorRewardsAgg,
      pendingReportsCount,
      visitorAnalytics,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.debate.count({ where: { status: 'active', createdAt: { gte: startOfToday } } }),
      prisma.creatorEarningsLedger.aggregate({
        _sum: { creatorRewardPaise: true },
        where: { status: { in: ['pending', 'available', 'paid'] } },
      }),
      prisma.debateReport.count({ where: { status: 'pending' } }),
      getAdminVisitorAnalytics(5),
    ]);

    const totalCreatorRewardsPaise = creatorRewardsAgg._sum?.creatorRewardPaise || 0;

    // 6. Top Debates
    const [topSupportedDebates, mostActiveDebates, topTrendingDebates] = await Promise.all([
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
    ]);

    return NextResponse.json({
      success: true,
      metrics: {
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
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to aggregate admin statistics' }, { status: 500 });
  }
}
