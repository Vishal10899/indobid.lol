import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateNextMinimumPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activeWhere = { status: 'active' };
    const includeCategory = {
      category: {
        select: { id: true, name: true, slug: true, icon: true },
      },
    };

    const [trendingNow, rising, newDebates, topDebates] = await Promise.all([
      // 🔥 Trending Now (sorted by trendingScore DESC)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ trendingScore: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: includeCategory,
      }),

      // ⚡ Rising Debates (debates with recent momentum)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ lastContributionAt: 'desc' }, { trendingScore: 'desc' }],
        take: 10,
        include: includeCategory,
      }),

      // 🆕 New Debates (sorted by createdAt DESC)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
        include: includeCategory,
      }),

      // 🏆 Top Debates (sorted by totalVerifiedContribution DESC)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ totalVerifiedContribution: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: includeCategory,
      }),
    ]);

    const formatDebate = (d: any) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      category: d.category,
      authorUsername: d.authorUsername,
      authorDisplayName: d.authorDisplayName,
      originalContribution: d.originalContribution,
      totalVerifiedContribution: d.totalVerifiedContribution,
      contributionCount: d.contributionCount,
      lastContributionAmount: d.lastContributionAmount,
      minimumNextContribution: calculateNextMinimumPaise(d.lastContributionAmount),
      trendingScore: d.trendingScore,
      createdAt: d.createdAt,
      lastContributionAt: d.lastContributionAt,
    });

    return NextResponse.json({
      success: true,
      trendingNow: trendingNow.map(formatDebate),
      rising: rising.map(formatDebate),
      newDebates: newDebates.map(formatDebate),
      topDebates: topDebates.map(formatDebate),
    });
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending debates' },
      { status: 500 }
    );
  }
}
