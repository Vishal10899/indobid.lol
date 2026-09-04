/**
 * INDOBID — SEARCH API ROUTE
 * Clean backend API consuming searchRanker for multi-dimensional search:
 * posts (debates), users, and categories/topics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { feedService } from '@/modules/feed/feed.service';
import { getCurrentUser } from '@/modules/auth/session.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get('q') || searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await feedService.search({
      query,
      category,
      page,
      limit,
      currentUserId: session?.userId || null,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute search' },
      { status: 500 }
    );
  }
}
