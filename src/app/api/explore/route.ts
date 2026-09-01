import { NextRequest, NextResponse } from 'next/server';
import { getDebates } from '@/lib/debates';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') || 'all';
    const sort = (searchParams.get('sort') || 'trending') as any;
    const search = searchParams.get('q') || searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await getDebates({
      category,
      sort,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Explore API error:', error);
    return NextResponse.json(
      { error: 'Failed to explore debates' },
      { status: 500 }
    );
  }
}
