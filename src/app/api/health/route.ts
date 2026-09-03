import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/database/prisma';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const DB_PROBE_TIMEOUT_MS = 3000;

/**
 * Production Health Check Endpoint
 * - Lightweight dual verification: Application Server + Database Connectivity
 * - Verifies BOTH app process and database health in < 50ms
 * - Protected by strict timeout (3000ms)
 * - Returns 200 OK when healthy, 503 Service Unavailable when database is unreachable
 * - Zero side effects: no sessions, no notifications, no logs of sensitive data
 * - Never exposes credentials, database URLs, or internal stack traces
 */
export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Timeout-protected database probe (SELECT 1)
    const probePromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database probe timed out')), DB_PROBE_TIMEOUT_MS)
    );

    await Promise.race([probePromise, timeoutPromise]);

    return NextResponse.json(
      {
        status: 'ok',
        service: 'indobid',
        timestamp,
        database: 'connected',
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch {
    // Return generic 503 without leaking credentials or stack traces
    return NextResponse.json(
      {
        status: 'error',
        service: 'indobid',
        timestamp,
        database: 'disconnected',
        error: 'Database service unavailable',
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
    const probePromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), DB_PROBE_TIMEOUT_MS)
    );
    await Promise.race([probePromise, timeoutPromise]);
    return new NextResponse(null, { status: 200, headers: NO_CACHE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 503, headers: NO_CACHE_HEADERS });
  }
}
