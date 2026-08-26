import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categorySlug = searchParams.get('category') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const result = await getLeaderboard({
      categorySlug: categorySlug === 'all' ? undefined : categorySlug,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return NextResponse.json({ error: 'Failed to retrieve leaderboard' }, { status: 500 });
  }
}
