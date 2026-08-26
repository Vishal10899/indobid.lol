import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * Ultra-lightweight Liveness Health Check
 * - Response Time: < 2ms (Zero database queries, zero external API calls)
 * - Public: No cookies, tokens, or authentication required
 * - Read-only: Cannot modify database state
 * - Compatible with external uptime monitors (GET & HEAD)
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: NO_CACHE_HEADERS,
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: NO_CACHE_HEADERS,
  });
}
