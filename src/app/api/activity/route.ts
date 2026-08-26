import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activities = await prisma.activityEvent.findMany({
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
          },
        },
      },
    });

    const formatted = activities.map((act) => ({
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

    return NextResponse.json({ activities: formatted });
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    return NextResponse.json({ error: 'Failed to fetch activity feed' }, { status: 500 });
  }
}
