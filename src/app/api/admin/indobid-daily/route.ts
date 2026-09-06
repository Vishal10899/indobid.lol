import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/modules/auth/authorization';
import { prisma } from '@/infrastructure/database/prisma';
import { runDailyPipeline } from '@/services/indobid-daily/daily-runner';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/indobid-daily
 * Returns engine status, recent automation runs, and recent automated posts
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const recentRuns = await prisma.automationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 15,
    });

    const recentPosts = await prisma.automatedPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        debate: {
          select: {
            id: true,
            title: true,
            status: true,
            trendingScore: true,
            createdAt: true,
            category: {
              select: { name: true, slug: true },
            },
          },
        },
      },
    });

    const totalAutomatedPosts = await prisma.automatedPost.count();
    const totalRuns = await prisma.automationRun.count();

    return NextResponse.json({
      success: true,
      config: {
        enabled: env.AUTO_DAILY_ENABLED,
        dryRunDefault: env.AUTO_DAILY_DRY_RUN,
        maxPostsPerDay: env.MAX_AUTO_POSTS_PER_DAY,
        trendScoreThreshold: env.TREND_SCORE_THRESHOLD,
        cooldownHours: env.MIN_HOURS_BETWEEN_SAME_TOPIC,
      },
      stats: {
        totalAutomatedPosts,
        totalRuns,
      },
      recentRuns,
      recentPosts,
    });
  } catch (error: any) {
    console.error('Error fetching admin IndoBid Daily status:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch status' }, { status: 500 });
  }
}

/**
 * POST /api/admin/indobid-daily
 * Allows admins to manually trigger an IndoBid Daily pipeline run
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== undefined ? Boolean(body.dryRun) : true;
    const force = Boolean(body.force);
    const limit = body.limit ? parseInt(body.limit, 10) : 3;

    const result = await runDailyPipeline({
      dryRun,
      force,
      limit,
    });

    return NextResponse.json({
      success: true,
      message: dryRun
        ? `Dry run executed successfully. ${result.candidatesSelected} candidates evaluated.`
        : `Run executed successfully. ${result.postsPublished} posts published.`,
      result,
    });
  } catch (error: any) {
    console.error('Error executing admin IndoBid Daily run:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute run' }, { status: 500 });
  }
}
