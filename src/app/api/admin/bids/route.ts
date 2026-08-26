import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const bids = await prisma.bid.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          select: { id: true, title: true, canonicalUrl: true },
        },
      },
    });

    return NextResponse.json({ bids });
  } catch (error) {
    console.error('Admin bids fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch bids' }, { status: 500 });
  }
}
