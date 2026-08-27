import { NextResponse } from 'next/server';
import { getPublicVisitorStats } from '@/lib/visitor-tracker';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * Public Real Visitor Analytics API
 * Returns 100% genuine database counts of active browser sessions and total unique visits.
 * Zero random numbers, zero simulation, zero fake counts.
 */
export async function GET() {
  try {
    const stats = await getPublicVisitorStats(2); // 2-minute active window

    return NextResponse.json(
      {
        success: true,
        liveVisitors: stats.liveVisitors,
        totalVisits: stats.totalVisits,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error('Visitor stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        liveVisitors: 0,
        totalVisits: 0,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}
