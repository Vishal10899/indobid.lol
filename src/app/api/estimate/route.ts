import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { estimateRank, MINIMUM_BID_CENTS } from '@/lib/ranking';
import { validateAndFormatUrl, normalizeCanonicalUrl } from '@/lib/url-utils';
import { z } from 'zod';

const estimateSchema = z.object({
  targetBidCents: z.number().int().positive().optional().nullable(),
  targetBidDollars: z.number().positive().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  listingId: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  destinationUrl: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = estimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    let targetBidCents = parsed.data.targetBidCents || undefined;
    if (!targetBidCents && parsed.data.targetBidDollars) {
      targetBidCents = Math.round(parsed.data.targetBidDollars * 100);
    }
    if (!targetBidCents || targetBidCents < MINIMUM_BID_CENTS) {
      targetBidCents = MINIMUM_BID_CENTS;
    }

    let existingListing = null;
    let listingId = parsed.data.listingId || undefined;
    const rawUrl = (parsed.data.destinationUrl || parsed.data.url)?.trim();

    if (listingId) {
      existingListing = await prisma.listing.findUnique({
        where: { id: listingId },
      });
    } else if (rawUrl) {
      const urlValidation = validateAndFormatUrl(rawUrl);
      if (urlValidation.isValid && urlValidation.formattedUrl) {
        const canonical = normalizeCanonicalUrl(urlValidation.formattedUrl);
        existingListing = await prisma.listing.findUnique({
          where: { canonicalUrl: canonical },
        });
        if (existingListing) {
          listingId = existingListing.id;
        }
      }
    }

    const currentVerifiedBidCents = existingListing ? (existingListing.verifiedBid || 0) : 0;
    
    // If target bid is less than current verified bid on existing listing, adjust target to at least current + $1
    let effectiveTargetBidCents: number = targetBidCents;
    if (existingListing && effectiveTargetBidCents <= currentVerifiedBidCents) {
      effectiveTargetBidCents = currentVerifiedBidCents + 100; // minimum $1 boost
    }

    const chargeAmountCents = Math.max(0, effectiveTargetBidCents - currentVerifiedBidCents);
    const categoryId = parsed.data.categoryId || existingListing?.categoryId || undefined;

    const rankEstimation = await estimateRank({
      targetBidCents: effectiveTargetBidCents,
      categoryId,
      listingId,
    });

    return NextResponse.json({
      targetBidCents: effectiveTargetBidCents,
      currentVerifiedBidCents,
      chargeAmountCents,
      targetBidFormatted: `$${(effectiveTargetBidCents / 100).toFixed(2)}`,
      currentVerifiedBidFormatted: `$${(currentVerifiedBidCents / 100).toFixed(2)}`,
      chargeAmountFormatted: `$${(chargeAmountCents / 100).toFixed(2)}`,
      estimatedRank: rankEstimation.estimatedRank,
      isExistingListing: !!existingListing,
    });
  } catch (error) {
    console.error('Error in estimate rank API:', error);
    return NextResponse.json({ error: 'Failed to calculate rank estimation' }, { status: 500 });
  }
}
