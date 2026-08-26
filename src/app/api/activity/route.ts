import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activities = await prisma.activityEvent.findMany({
      where: {
        listing: {
          status: 'active',
          verifiedBid: { gt: 0 },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            logoUrl: true,
            destinationType: true,
            verifiedBid: true,
            status: true,
          },
        },
      },
    });

    const formatted = activities
      .filter((act) => act.listing && act.listing.status === 'active' && act.listing.verifiedBid > 0)
      .map((act) => ({
        id: act.id,
        listingId: act.listingId,
        type: act.type,
        title: act.title,
        destinationType: act.destinationType,
        amount: act.amount,
        rank: act.rank,
        message: act.message,
        createdAt: act.createdAt,
        logoUrl: act.listing?.logoUrl || null,
      }));

    return NextResponse.json(
      { activities: formatted },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return NextResponse.json({ error: 'Failed to fetch activity feed' }, { status: 500 });
  }
}
