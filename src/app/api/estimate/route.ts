import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { estimateRank, MINIMUM_BID_CENTS } from '@/lib/ranking';
import { validateAndFormatUrl, normalizeCanonicalUrl } from '@/lib/url-utils';
import { z } from 'zod';

const estimateSchema = z.object({
  targetBidCents: z.number().int().positive().optional(),
  targetBidDollars: z.number().positive().optional(),
  categoryId: z.string().optional(),
  listingId: z.string().optional(),
  url: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = estimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    let targetBidCents = parsed.data.targetBidCents;
    if (!targetBidCents && parsed.data.targetBidDollars) {
      targetBidCents = Math.round(parsed.data.targetBidDollars * 100);
    }
    if (!targetBidCents || targetBidCents < MINIMUM_BID_CENTS) {
      targetBidCents = MINIMUM_BID_CENTS;
    }

    let existingListing = null;
    let listingId = parsed.data.listingId;

    if (listingId) {
      existingListing = await prisma.listing.findUnique({
        where: { id: listingId },
      });
    } else if (parsed.data.url) {
      const { isValid, formattedUrl } = validateAndFormatUrl(parsed.data.url);
      if (isValid) {
        const canonical = normalizeCanonicalUrl(formattedUrl);
        existingListing = await prisma.listing.findUnique({
          where: { canonicalUrl: canonical },
        });
        if (existingListing) {
          listingId = existingListing.id;
        }
      }
    }

    const currentVerifiedBidCents = existingListing ? existingListing.verifiedBid : 0;
    
    // If target bid is less than current verified bid on existing listing, adjust target to at least current + $1
    let effectiveTargetBidCents = targetBidCents;
    if (existingListing && effectiveTargetBidCents <= currentVerifiedBidCents) {
      effectiveTargetBidCents = currentVerifiedBidCents + 100; // minimum $1 boost
    }

    const chargeAmountCents = Math.max(0, effectiveTargetBidCents - currentVerifiedBidCents);

    const categoryId = parsed.data.categoryId || existingListing?.categoryId;

    const rankEstimation = await estimateRank({
      bidAmountCents: effectiveTargetBidCents,
      categoryId,
      excludeListingId: listingId,
    });

    return NextResponse.json({
      targetBidCents: effectiveTargetBidCents,
      currentVerifiedBidCents,
      chargeAmountCents,
      isExistingListing: !!existingListing,
      listingId: existingListing?.id || null,
      ...rankEstimation,
    });
  } catch (error) {
    console.error('Error estimating rank:', error);
    return NextResponse.json({ error: 'Failed to estimate rank' }, { status: 500 });
  }
}
