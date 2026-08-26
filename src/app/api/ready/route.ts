import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * Database Readiness Probe
 * - Executes lightweight read-only SELECT 1 query
 * - Returns 200 OK when database connection is healthy
 * - Returns 503 Service Unavailable when database is unreachable
 * - Strictly read-only: Cannot modify database state
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Minimal read-only connectivity probe: SELECT 1
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: 'ready',
        database: 'connected',
        latencyMs: Date.now() - startTime,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (error) {
    console.error('Readiness database probe error:', error);

    return NextResponse.json(
      {
        status: 'unready',
        database: 'disconnected',
        error: 'Database connection probe failed',
      },
      {
        status: 503,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}

export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200, headers: NO_CACHE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 503, headers: NO_CACHE_HEADERS });
  }
}
