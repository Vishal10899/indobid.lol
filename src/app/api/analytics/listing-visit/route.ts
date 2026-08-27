import { NextRequest, NextResponse } from 'next/server';
import { recordListingVisit } from '@/lib/visitor-tracker';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { listingId, sessionToken } = body;

    if (!listingId || !sessionToken) {
      return NextResponse.json(
        { error: 'listingId and sessionToken are required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const userAgent = request.headers.get('user-agent');
    const result = await recordListingVisit({
      listingId,
      sessionToken,
      userAgent,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: NO_CACHE_HEADERS,
    });
  } catch (error) {
    console.error('Listing visit API error:', error);
    return NextResponse.json({ success: false, counted: false }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
