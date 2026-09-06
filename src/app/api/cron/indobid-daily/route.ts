import { NextRequest, NextResponse } from 'next/server';
import { runDailyPipeline } from '@/services/indobid-daily/daily-runner';
import { env } from '@/config/env';

/**
 * INDOBID DAILY CRON ENDPOINT
 * GET /api/cron/indobid-daily
 * POST /api/cron/indobid-daily
 *
 * Protected via CRON_SECRET authorization header or query param.
 * Query options:
 * - ?dryRun=true/false
 * - ?force=true/false
 * - ?limit=N
 * - ?minScore=N
 */
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  // Authorization check
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secretHeader = request.headers.get('x-cron-secret') || '';
  const searchParams = request.nextUrl.searchParams;
  const secretQuery = searchParams.get('secret') || '';

  const providedSecret = token || secretHeader || secretQuery;
  const expectedSecret = env.CRON_SECRET;

  if (expectedSecret && providedSecret !== expectedSecret) {
    // In production or when CRON_SECRET is configured, enforce secret
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Invalid or missing cron secret',
      },
      { status: 401 }
    );
  }

  // Parse options
  const dryRunParam = searchParams.get('dryRun');
  const dryRun = dryRunParam !== null ? dryRunParam === 'true' : undefined;

  const forceParam = searchParams.get('force');
  const force = forceParam === 'true';

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const minScoreParam = searchParams.get('minScore');
  const minScore = minScoreParam ? parseInt(minScoreParam, 10) : undefined;

  try {
    const result = await runDailyPipeline({
      dryRun,
      force,
      limit,
      minScore,
    });

    return NextResponse.json({
      success: result.status !== 'failed',
      message: result.isDryRun
        ? `IndoBid Daily completed in DRY-RUN mode. ${result.candidatesSelected} candidates identified.`
        : `IndoBid Daily completed. ${result.postsPublished} posts published.`,
      result,
    });
  } catch (error: any) {
    console.error('[IndoBid Daily Cron Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal IndoBid Daily execution failure',
      },
      { status: 500 }
    );
  }
}
