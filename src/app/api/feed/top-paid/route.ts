/**
 * INDOBID — TOP PAID FEED API ROUTE
 * Clean backend API consuming topPaidRanker for canonical paid priority rankings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedService } from '@/modules/feed/feed.service';
import { getCurrentUser } from '@/modules/auth/session.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    const searchParams = request.nextUrl.searchParams;

    const category = searchParams.get('category') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const paidOnly = searchParams.get('paidOnly') === 'true';

    const result = await feedService.getTopPaid({
      currentUserId: session?.userId || null,
      category,
      page,
      limit,
      paidOnly,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Top Paid API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Top Paid feed' },
      { status: 500 }
    );
  }
}
