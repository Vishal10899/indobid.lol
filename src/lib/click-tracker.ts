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
];

function isKnownBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`${ip}_indobid_salt`).digest('hex').substring(0, 32);
}

/**
 * Records an outbound click safely with anti-abuse protection and returns destination URL
 */
export async function trackOutboundClick({
  listingId,
  ip,
  userAgent,
  referrer,
}: {
  listingId: string;
  ip: string;
  userAgent: string | null;
  referrer: string | null;
}): Promise<{ destinationUrl: string | null; counted: boolean }> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, destinationUrl: true, status: true },
  });

  if (!listing) {
    return { destinationUrl: null, counted: false };
  }

  // If known bot, redirect without incrementing click count
  if (isKnownBot(userAgent)) {
    return { destinationUrl: listing.destinationUrl, counted: false };
  }

  const ipHash = hashIp(ip);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Check if this hashed IP already clicked this specific listing in the last hour
  const recentClick = await prisma.click.findFirst({
    where: {
      listingId,
      ipHash,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentClick) {
    // Already counted recently - prevent spam inflating, just redirect
    return { destinationUrl: listing.destinationUrl, counted: false };
  }

  // Increment click count atomically and record click
  await prisma.$transaction([
    prisma.listing.update({
      where: { id: listingId },
      data: { clickCount: { increment: 1 } },
    }),
    prisma.click.create({
      data: {
        listingId,
        ipHash,
        userAgent: userAgent ? userAgent.substring(0, 255) : null,
        referrer: referrer ? referrer.substring(0, 255) : null,
      },
    }),
  ]);

  return { destinationUrl: listing.destinationUrl, counted: true };
}
