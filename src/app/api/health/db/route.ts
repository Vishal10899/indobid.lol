import { NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/database/prisma';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

const DB_PROBE_TIMEOUT_MS = 5000;

/**
 * Deeper Database Health Check Endpoint
 * - Dedicated database connectivity & latency probe
 * - Measures roundtrip latency without executing business queries
 * - Safe generic error handling (HTTP 503 on failure, zero credential leak)
 */
export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const probePromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database query timed out')), DB_PROBE_TIMEOUT_MS)
    );

    await Promise.race([probePromise, timeoutPromise]);
    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        latencyMs,
        timestamp,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: 'Database connection failed',
        timestamp,
      },
      {
        status: 503,
        headers: NO_CACHE_HEADERS,
      }
    );
  }
}
