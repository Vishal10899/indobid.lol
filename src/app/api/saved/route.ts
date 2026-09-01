import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/user-auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';

    const bookmarks = await prisma.debateBookmark.findMany({
      where: {
        userId: session.userId,
        debate: {
          status: 'active',
          ...(category !== 'all' ? { category: { slug: category } } : {}),
        },
      },
      include: {
        debate: {
          include: {
            category: { select: { id: true, name: true, slug: true, icon: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const items = bookmarks.map((b) => {
      const d = b.debate;
      return {
        id: d.id,
        title: d.title,
        content: d.content,
        category: d.category,
        authorUsername: d.isAnonymous ? 'anonymous' : d.authorUsername,
        authorDisplayName: d.isAnonymous ? 'Anonymous' : d.authorDisplayName,
        originalContribution: d.originalContribution,
        totalVerifiedContribution: d.totalVerifiedContribution,
        contributionCount: d.contributionCount,
        lastContributionAmount: d.lastContributionAmount,
        minimumNextContribution: d.lastContributionAmount + 100,
        trendingScore: d.trendingScore,
        likeCount: d.likeCount,
        impressionCount: d.impressionCount,
        isAnonymous: d.isAnonymous,
        hashtags: d.hashtags,
        createdAt: d.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, items, total: items.length });
  } catch (error) {
    console.error('Saved debates fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch saved debates' }, { status: 500 });
  }
}
