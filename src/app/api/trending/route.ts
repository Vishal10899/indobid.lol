import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateNextMinimumPaise } from '@/lib/money';
import { resolveAuthorIdentity } from '@/modules/users/author-identity';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activeWhere = { status: 'active' };
    const includeRelations = {
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
    };

    const [overallTrending, topPaid, topReach, topEngagement, rising, newDebates] = await Promise.all([
      // 🔥 Overall Trending (multi-signal momentum: reach, engagement, paid conviction, velocity, recency)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ trendingScore: 'desc' }, { lastContributionAt: 'desc' }, { createdAt: 'desc' }],
        take: 15,
        include: includeRelations,
      }),

      // 💰 Top Paid (strictly ordered by confirmed totalVerifiedContribution DESC)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ totalVerifiedContribution: 'desc' }, { createdAt: 'desc' }],
        take: 15,
        include: includeRelations,
      }),

      // 👁️ Top Reach (strictly ordered by real impressionCount DESC)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ impressionCount: 'desc' }, { createdAt: 'desc' }],
        take: 15,
        include: includeRelations,
      }),

      // ❤️ Top Engagement (strictly ordered by likeCount & discussion depth DESC)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ likeCount: 'desc' }, { contributionCount: 'desc' }, { createdAt: 'desc' }],
        take: 15,
        include: includeRelations,
      }),

      // ⚡ Rising Debates (debates with recent momentum)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ lastContributionAt: 'desc' }, { trendingScore: 'desc' }],
        take: 15,
        include: includeRelations,
      }),

      // 🆕 New Debates (sorted by createdAt DESC)
      prisma.debate.findMany({
        where: activeWhere,
        orderBy: [{ createdAt: 'desc' }],
        take: 15,
        include: includeRelations,
      }),
    ]);

    const formatDebate = (d: any) => {
      const resolved = resolveAuthorIdentity({
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        authorDisplayName: d.authorDisplayName,
        author: d.author,
        isAnonymous: d.isAnonymous,
        isGhost: d.isGhost,
      });

      return {
        id: d.id,
        title: d.title,
        content: d.content,
        category: d.category,
        authorUsername: resolved.authorUsername,
        authorDisplayName: resolved.authorDisplayName,
        authorAvatarUrl: resolved.authorAvatarUrl,
        authorIsVerified: resolved.authorIsVerified,
        authorRole: resolved.authorRole,
        isAnonymous: resolved.isAnonymous,
        isGhost: resolved.isGhost,
        isClickableProfile: resolved.isClickableProfile,
        originalContribution: d.originalContribution,
        totalVerifiedContribution: d.totalVerifiedContribution,
        contributionCount: d.contributionCount,
        lastContributionAmount: d.lastContributionAmount,
        minimumNextContribution: calculateNextMinimumPaise(d.lastContributionAmount),
        trendingScore: d.trendingScore,
        likeCount: d.likeCount,
        impressionCount: d.impressionCount,
        createdAt: d.createdAt,
        lastContributionAt: d.lastContributionAt,
      };
    };

    return NextResponse.json({
      success: true,
      overallTrending: overallTrending.map(formatDebate),
      topPaid: topPaid.map(formatDebate),
      topReach: topReach.map(formatDebate),
      topEngagement: topEngagement.map(formatDebate),
      rising: rising.map(formatDebate),
      newDebates: newDebates.map(formatDebate),
      // Backwards-compatible aliases for existing client components
      trendingNow: overallTrending.map(formatDebate),
      topDebates: topPaid.map(formatDebate),
    });
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trending debates' },
      { status: 500 }
    );
  }
}
