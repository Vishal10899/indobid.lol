import crypto from 'crypto';
import { prisma } from './db';

const BOT_PATTERNS = [
  /bot/i,
  /spider/i,
  /crawl/i,
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /embedly/i,
  /quora link preview/i,
  /showyoubot/i,
  /outbrain/i,
  /pinterest/i,
  /slackbot/i,
  /vkshare/i,
  /w3c_validator/i,
  /render/i,
  /uptime/i,
  /ping/i,
  /curl/i,
  /wget/i,
  /headlesschrome/i,
  /lighthouse/i,
];

export function isKnownBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`${ip}_indobid_visitor_salt`).digest('hex').substring(0, 32);
}

/**
 * Validates and sanitizes a client-provided session token.
 * Must be a non-empty alphanumeric/hyphen/underscore string of 10-80 chars.
 */
function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  return trimmed.length >= 10 && trimmed.length <= 80 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Records or updates an active visitor session from a genuine public browser heartbeat.
 * - Deduplicates by sessionToken (sessionStorage on client).
 * - Excludes bots, health checks, cron requests, and API polling.
 */
export async function recordVisitorHeartbeat({
  sessionToken,
  ip,
  userAgent,
}: {
  sessionToken: string;
  ip: string;
  userAgent: string | null;
}): Promise<{ success: boolean; isNewSession: boolean }> {
  if (!isValidSessionToken(sessionToken)) {
    return { success: false, isNewSession: false };
  }

  if (isKnownBot(userAgent)) {
    return { success: false, isNewSession: false };
  }

  const ipHash = hashIp(ip);
  const now = new Date();

  try {
    const existing = await prisma.visitorSession.findUnique({
      where: { sessionToken },
    });

    if (existing) {
      await prisma.visitorSession.update({
        where: { id: existing.id },
        data: {
          lastHeartbeatAt: now,
        },
      });
      return { success: true, isNewSession: false };
    }

    await prisma.visitorSession.create({
      data: {
        sessionToken,
        ipHash,
        userAgent: userAgent ? userAgent.substring(0, 255) : null,
        firstSeenAt: now,
        lastHeartbeatAt: now,
        pageViews: 1,
      },
    });

    return { success: true, isNewSession: true };
  } catch (error) {
    console.error('Error recording visitor heartbeat:', error);
    return { success: false, isNewSession: false };
  }
}

/**
 * Returns real public visitor analytics from actual database records.
 * - Live Visitors: Count of unique sessions with heartbeats within the last active window (2 minutes).
 * - Total Visits: Total count of unique browser sessions recorded.
 * - Strictly 0 when no records exist.
 */
export async function getPublicVisitorStats(activeWindowMinutes = 2): Promise<{
  liveVisitors: number;
  totalVisits: number;
}> {
  const activeThreshold = new Date(Date.now() - activeWindowMinutes * 60 * 1000);

  try {
    const liveVisitors = await prisma.visitorSession.count({
      where: {
        lastHeartbeatAt: { gte: activeThreshold },
      },
    });
    const totalVisits = await prisma.visitorSession.count();

    return {
      liveVisitors,
      totalVisits,
    };
  } catch (error) {
    console.error('Error querying public visitor stats:', error);
    return {
      liveVisitors: 0,
      totalVisits: 0,
    };
  }
}

/**
 * Returns real admin visitor analytics broken down by genuine time intervals.
 * All numbers derived 100% from production database records.
 */
export async function getAdminVisitorAnalytics(activeWindowMinutes = 2): Promise<{
  liveActive: number;
  today: number;
  yesterday: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
  totalPageViews: number;
}> {
  const now = new Date();
  const activeThreshold = new Date(now.getTime() - activeWindowMinutes * 60 * 1000);

  // UTC-based date boundaries for deterministic stats
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const liveActive = await prisma.visitorSession.count({
      where: { lastHeartbeatAt: { gte: activeThreshold } },
    });
    const today = await prisma.visitorSession.count({
      where: { firstSeenAt: { gte: startOfToday } },
    });
    const yesterday = await prisma.visitorSession.count({
      where: {
        firstSeenAt: {
          gte: startOfYesterday,
          lt: startOfToday,
        },
      },
    });
    const last7Days = await prisma.visitorSession.count({
      where: { firstSeenAt: { gte: sevenDaysAgo } },
    });
    const last30Days = await prisma.visitorSession.count({
      where: { firstSeenAt: { gte: thirtyDaysAgo } },
    });
    const allTime = await prisma.visitorSession.count();
    const pageViewsAgg = await prisma.visitorSession.aggregate({
      _sum: { pageViews: true },
    });

    return {
      liveActive,
      today,
      yesterday,
      last7Days,
      last30Days,
      allTime,
      totalPageViews: pageViewsAgg._sum.pageViews || 0,
    };
  } catch (error) {
    console.error('Error querying admin visitor analytics:', error);
    return {
      liveActive: 0,
      today: 0,
      yesterday: 0,
      last7Days: 0,
      last30Days: 0,
      allTime: 0,
      totalPageViews: 0,
    };
  }
}
