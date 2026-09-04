/**
 * INDOBID — FOLLOWING FEED API ROUTE
 * Clean backend API consuming followingRanker for followed creators feed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedService } from '@/modules/feed/feed.service';
import { getCurrentUser } from '@/modules/auth/session.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session?.userId) {
      return NextResponse.json(
        { items: [], debates: [], total: 0, page: 1, limit: 20, totalPages: 1 },
        { status: 200 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await feedService.getFollowing({
      currentUserId: session.userId,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Following feed API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch following feed' },
      { status: 500 }
    );
  }
}
