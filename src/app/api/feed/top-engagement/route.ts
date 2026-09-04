/**
 * INDOBID — TOP ENGAGEMENT FEED API ROUTE
 * Clean backend API consuming topEngagementRanker for discussion & engagement feeds.
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

    const result = await feedService.getTopEngagement({
      currentUserId: session?.userId || null,
      category,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Top Engagement feed API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Top Engagement feed' },
      { status: 500 }
    );
  }
}
