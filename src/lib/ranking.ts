import { prisma } from './db';
import { Prisma } from '@prisma/client';

export const MINIMUM_BID_AMOUNT_INR = 2; // Testing phase central minimum (₹2 INR)
export const MINIMUM_BID_CENTS = 200; // In integer minor units (200 cents/paise)
export const DEFAULT_INCREMENT_CENTS = 300; // +₹3.00 default suggestion above current verified bid
export const MINIMUM_INCREMENT_CENTS = 100; // ₹1.00 minimum outbid increment

export function centsToDollars(cents: number): number {
  return Math.floor(cents) / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatCurrency(cents: number, includeCentsIfZero: boolean = false): string {
  const amount = cents / 100;
  if (amount % 1 === 0 && !includeCentsIfZero) {
    return `₹${amount.toLocaleString()}`;
  }
  return `₹${amount.toFixed(2)}`;
}

export interface LeaderboardItem {
  id: string;
  rank: number;
  categoryRank?: number;
  destinationUrl: string;
  canonicalUrl: string;
  destinationType: string;
  title: string;
  description: string;
  logoUrl: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  verifiedBid: number; // in cents
  currency: string;
  countryCode: string | null;
  clickCount: number;
  status: string;
  socialWebsite: string | null;
  socialInstagram: string | null;
  socialYoutube: string | null;
  socialX: string | null;
  createdAt: Date;
  updatedAt: Date;
  bidReachedAt: Date;
  minOutbidCents: number; // minimum amount to outbid this item
}

export interface LeaderboardResult {
  items: LeaderboardItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  highestBidCents: number;
  minimumToTakeFirstCents: number;
}

/**
 * Fetch leaderboard with deterministic sorting:
 * ORDER BY verified_bid DESC, bid_reached_at ASC
 * STRICT DEFENSIVE CONDITION: Only verified active listings with verifiedBid > 0 are returned.
 */
export async function getLeaderboard({
  categorySlug,
  page = 1,
  limit = 50,
  includeHidden = false,
}: {
  categorySlug?: string;
  page?: number;
  limit?: number;
  includeHidden?: boolean;
}): Promise<LeaderboardResult> {
  const skip = (page - 1) * limit;

  // Build where clause: Must have verifiedBid > 0 and status === 'active'
  const where: Prisma.ListingWhereInput = {
    verifiedBid: { gt: 0 },
  };

  if (!includeHidden) {
    where.status = 'active';
  }

  let selectedCategory = null;
  if (categorySlug && categorySlug !== 'all') {
    selectedCategory = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });
    if (selectedCategory) {
      where.categoryId = selectedCategory.id;
    }
  }

  // Count total active verified listings
  const total = await prisma.listing.count({ where });

  // Get current active #1 listing globally to calculate minimumToTakeFirst
  const globalFirst = await prisma.listing.findFirst({
    where: { status: 'active', verifiedBid: { gt: 0 } },
    orderBy: [
      { verifiedBid: 'desc' },
      { bidReachedAt: 'asc' },
    ],
  });

  const highestBidCents = globalFirst?.verifiedBid || 0;
  const minimumToTakeFirstCents = highestBidCents > 0
    ? highestBidCents + MINIMUM_INCREMENT_CENTS
    : MINIMUM_BID_CENTS;

  // Query ordered listings
  const listings = await prisma.listing.findMany({
    where,
    orderBy: [
      { verifiedBid: 'desc' },
      { bidReachedAt: 'asc' },
    ],
    skip,
    take: limit,
    include: {
      category: true,
    },
  });

  const items: LeaderboardItem[] = listings.map((listing, index) => {
    const rank = skip + index + 1;
    // Default suggested target: current verified bid + $3.00
    const minOutbidCents = listing.verifiedBid + DEFAULT_INCREMENT_CENTS;

    return {
      id: listing.id,
      rank,
      destinationUrl: listing.destinationUrl,
      canonicalUrl: listing.canonicalUrl,
      destinationType: listing.destinationType,
      title: listing.title,
      description: listing.description,
      logoUrl: listing.logoUrl,
      categoryId: listing.categoryId,
      categoryName: listing.category.name,
      categorySlug: listing.category.slug,
      verifiedBid: listing.verifiedBid,
      currency: listing.currency,
      countryCode: listing.countryCode,
      clickCount: listing.clickCount,
      status: listing.status,
      socialWebsite: listing.socialWebsite,
      socialInstagram: listing.socialInstagram,
      socialYoutube: listing.socialYoutube,
      socialX: listing.socialX,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      bidReachedAt: listing.bidReachedAt,
      minOutbidCents,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    category: selectedCategory ? {
      id: selectedCategory.id,
      name: selectedCategory.name,
      slug: selectedCategory.slug,
    } : null,
    highestBidCents,
    minimumToTakeFirstCents,
  };
}

/**
 * Calculates estimated global & category rank for a given bid amount (in cents)
 */
export async function estimateRank({
  bidAmountCents,
  categoryId,
  excludeListingId,
}: {
  bidAmountCents: number;
  categoryId?: string;
  excludeListingId?: string;
}): Promise<{
  estimatedGlobalRank: number;
  estimatedCategoryRank?: number;
  isFirstPlace: boolean;
  amountToBeatNumberOneCents: number;
  competitorAhead?: {
    title: string;
    verifiedBid: number;
    rank: number;
  } | null;
}> {
  // Count how many active listings have verified_bid > bidAmountCents
  // or verified_bid == bidAmountCents (since existing ones reached it earlier)
  const globalHigherCount = await prisma.listing.count({
    where: {
      status: 'active',
      verifiedBid: { gt: 0 },
      id: excludeListingId ? { not: excludeListingId } : undefined,
      OR: [
        { verifiedBid: { gt: bidAmountCents } },
        { verifiedBid: { equals: bidAmountCents } },
      ],
    },
  });

  const estimatedGlobalRank = globalHigherCount + 1;

  let estimatedCategoryRank: number | undefined = undefined;
  if (categoryId) {
    const categoryHigherCount = await prisma.listing.count({
      where: {
        status: 'active',
        verifiedBid: { gt: 0 },
        categoryId,
        id: excludeListingId ? { not: excludeListingId } : undefined,
        OR: [
          { verifiedBid: { gt: bidAmountCents } },
          { verifiedBid: { equals: bidAmountCents } },
        ],
      },
    });
    estimatedCategoryRank = categoryHigherCount + 1;
  }

  // Find current #1 listing
  const numberOne = await prisma.listing.findFirst({
    where: {
      status: 'active',
      verifiedBid: { gt: 0 },
      id: excludeListingId ? { not: excludeListingId } : undefined,
    },
    orderBy: [
      { verifiedBid: 'desc' },
      { bidReachedAt: 'asc' },
    ],
  });

  const isFirstPlace = !numberOne || bidAmountCents > numberOne.verifiedBid;
  const amountToBeatNumberOneCents = numberOne
    ? Math.max(0, numberOne.verifiedBid + MINIMUM_INCREMENT_CENTS - bidAmountCents)
    : 0;

  // Find competitor immediately ahead if not #1
  let competitorAhead = null;
  if (estimatedGlobalRank > 1) {
    const aheadListing = await prisma.listing.findFirst({
      where: {
        status: 'active',
        verifiedBid: { gt: 0 },
        id: excludeListingId ? { not: excludeListingId } : undefined,
        OR: [
          { verifiedBid: { gt: bidAmountCents } },
          { verifiedBid: { equals: bidAmountCents } },
        ],
      },
      orderBy: [
        { verifiedBid: 'asc' },
        { bidReachedAt: 'desc' },
      ],
    });

    if (aheadListing) {
      competitorAhead = {
        title: aheadListing.title,
        verifiedBid: aheadListing.verifiedBid,
        rank: estimatedGlobalRank - 1,
      };
    }
  }

  return {
    estimatedGlobalRank,
    estimatedCategoryRank,
    isFirstPlace,
    amountToBeatNumberOneCents,
    competitorAhead,
  };
}

/**
 * Gets exact global and category rank of an existing listing
 */
export async function getListingRanks(listingId: string): Promise<{ globalRank: number; categoryRank: number }> {
  const target = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { verifiedBid: true, bidReachedAt: true, categoryId: true, status: true },
  });

  if (!target || target.status !== 'active' || target.verifiedBid <= 0) {
    return { globalRank: 0, categoryRank: 0 };
  }

  // Count active listings strictly higher or equal with earlier date
  const globalCount = await prisma.listing.count({
    where: {
      status: 'active',
      verifiedBid: { gt: 0 },
      OR: [
        { verifiedBid: { gt: target.verifiedBid } },
        {
          AND: [
            { verifiedBid: { equals: target.verifiedBid } },
            { bidReachedAt: { lt: target.bidReachedAt } },
          ],
        },
      ],
    },
  });

  const categoryCount = await prisma.listing.count({
    where: {
      status: 'active',
      verifiedBid: { gt: 0 },
      categoryId: target.categoryId,
      OR: [
        { verifiedBid: { gt: target.verifiedBid } },
        {
          AND: [
            { verifiedBid: { equals: target.verifiedBid } },
            { bidReachedAt: { lt: target.bidReachedAt } },
          ],
        },
      ],
    },
  });

  return {
    globalRank: globalCount + 1,
    categoryRank: categoryCount + 1,
  };
}
