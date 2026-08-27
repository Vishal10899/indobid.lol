import { NextResponse } from 'next/server';
import { getTopVisitedListings } from '@/lib/visitor-tracker';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET() {
  try {
    const listings = await getTopVisitedListings(5);

    return NextResponse.json(
      {
        success: true,
        items: listings,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error('Top visited listings API error:', error);
    return NextResponse.json(
      {
        success: false,
        items: [],
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}
