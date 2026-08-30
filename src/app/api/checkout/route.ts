import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAndFormatUrl, normalizeCanonicalUrl, detectDestinationType, sanitizeText } from '@/lib/url-utils';
import { razorpayProvider } from '@/lib/payments/razorpay-provider';
import { MINIMUM_BID_CENTS, MINIMUM_INCREMENT_CENTS } from '@/lib/ranking';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isValidCountryCode, DEFAULT_COUNTRY_CODE } from '@/lib/countries';
import { z } from 'zod';

const checkoutSchema = z.object({
  // Either existing listing ID
  listingId: z.string().optional(),
  
  // Or new destination details
  destinationUrl: z.string().optional(),
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  categoryId: z.string().optional(),
  countryCode: z.string().optional().nullable(),
  
  // Target bid amounts
  targetTotalBidDollars: z.number().positive().optional(),
  targetTotalBidCents: z.number().int().positive().optional(),
  
  logoUrl: z.string().optional().nullable(),
  socialWebsite: z.string().optional().nullable(),
  socialInstagram: z.string().optional().nullable(),
  socialYoutube: z.string().optional().nullable(),
  socialX: z.string().optional().nullable(),
  bidderEmail: z.string().email('Invalid email address').optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`checkout:${ip}`, 30, 60);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many checkout requests. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    // 2. Validate input schema
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid input data';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = parsed.data;

    // Validate countryCode if provided
    let normalizedCountryCode = DEFAULT_COUNTRY_CODE;
    if (data.countryCode !== undefined && data.countryCode !== null && data.countryCode !== '') {
      if (!isValidCountryCode(data.countryCode)) {
        return NextResponse.json(
          { error: 'Invalid country code. Please provide a valid 2-letter ISO country code.' },
          { status: 400 }
        );
      }
      normalizedCountryCode = data.countryCode.trim().toUpperCase();
    }

    let listing = null;
    let currentVerifiedBidCents = 0;
    let chargeAmountCents = 0;
    let finalTargetTotalCents = 0;

    // CASE A: Existing Listing by ID (1-Click Outbid from Leaderboard)
    if (data.listingId) {
      listing = await prisma.listing.findUnique({
        where: { id: data.listingId },
        include: { category: true },
      });

      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }

      currentVerifiedBidCents = listing.verifiedBid;

      if (data.targetTotalBidCents) {
        finalTargetTotalCents = data.targetTotalBidCents;
      } else if (data.targetTotalBidDollars) {
        finalTargetTotalCents = Math.round(data.targetTotalBidDollars * 100);
      } else {
        // Default target: outbid current by minimum increment ($1.00)
        finalTargetTotalCents = currentVerifiedBidCents + MINIMUM_INCREMENT_CENTS;
      }

      // Enforce that new target bid must be higher than current verified bid
      if (finalTargetTotalCents <= currentVerifiedBidCents) {
        finalTargetTotalCents = currentVerifiedBidCents + MINIMUM_INCREMENT_CENTS;
      }

      // Exact backend difference calculation: requested target - current verified total
      chargeAmountCents = finalTargetTotalCents - currentVerifiedBidCents;

      // Update country if explicitly provided
      if (data.countryCode) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: { countryCode: normalizedCountryCode },
        });
      }
    }
    // CASE B: Destination URL submission (New or existing by canonical URL)
    else if (data.destinationUrl) {
      const { isValid, formattedUrl, error: urlError } = validateAndFormatUrl(data.destinationUrl);
      if (!isValid) {
        return NextResponse.json({ error: urlError || 'Invalid destination URL' }, { status: 400 });
      }

      const canonicalUrl = normalizeCanonicalUrl(formattedUrl);
      const destinationType = detectDestinationType(formattedUrl);

      // Check if listing already exists with this canonical URL
      listing = await prisma.listing.findUnique({
        where: { canonicalUrl },
        include: { category: true },
      });

      let categoryId = data.categoryId;
      if (!categoryId && listing) {
        categoryId = listing.categoryId;
      }
      if (!categoryId) {
        const firstCat = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' } });
        categoryId = firstCat?.id || '';
      }

      const requestedTotal = data.targetTotalBidCents
        ? data.targetTotalBidCents
        : data.targetTotalBidDollars
        ? Math.round(data.targetTotalBidDollars * 100)
        : MINIMUM_BID_CENTS;

      if (listing) {
        currentVerifiedBidCents = listing.verifiedBid;
        finalTargetTotalCents = requestedTotal;
        if (finalTargetTotalCents <= currentVerifiedBidCents) {
          const verifiedDollars = (currentVerifiedBidCents / 100).toLocaleString();
          return NextResponse.json(
            {
              error: `Current verified bid is $${verifiedDollars}. A target below or equal to $${verifiedDollars} will not increase this listing's position.`,
            },
            { status: 400 }
          );
        }
        chargeAmountCents = finalTargetTotalCents - currentVerifiedBidCents;

        // Update metadata & country
        listing = await prisma.listing.update({
          where: { id: listing.id },
          data: {
            title: data.title ? sanitizeText(data.title, 100) : listing.title,
            description: data.description ? sanitizeText(data.description, 500) : listing.description,
            logoUrl: data.logoUrl ? sanitizeText(data.logoUrl, 500) : listing.logoUrl,
            destinationUrl: formattedUrl,
            countryCode: data.countryCode ? normalizedCountryCode : listing.countryCode || normalizedCountryCode,
          },
          include: { category: true },
        });
      } else {
        // Brand new listing created in pending_payment state with verifiedBid = 0
        if (requestedTotal < MINIMUM_BID_CENTS) {
          return NextResponse.json(
            { error: `Minimum bid amount is $2 (200 cents)` },
            { status: 400 }
          );
        }
        finalTargetTotalCents = requestedTotal;
        chargeAmountCents = finalTargetTotalCents;

        const defaultTitle = new URL(formattedUrl).hostname.replace(/^www\./, '');
        const defaultDesc = `Public ranking for ${formattedUrl}`;

        listing = await prisma.listing.create({
          data: {
            destinationUrl: formattedUrl,
            canonicalUrl,
            destinationType,
            title: sanitizeText(data.title || defaultTitle, 100),
            description: sanitizeText(data.description || defaultDesc, 500),
            categoryId,
            countryCode: normalizedCountryCode,
            logoUrl: data.logoUrl ? sanitizeText(data.logoUrl, 500) : null,
            socialWebsite: data.socialWebsite ? sanitizeText(data.socialWebsite, 300) : null,
            socialInstagram: data.socialInstagram ? sanitizeText(data.socialInstagram, 300) : null,
            socialYoutube: data.socialYoutube ? sanitizeText(data.socialYoutube, 300) : null,
            socialX: data.socialX ? sanitizeText(data.socialX, 300) : null,
            verifiedBid: 0,
            status: 'pending_payment',
          },
          include: { category: true },
        });
      }
    } else {
      return NextResponse.json({ error: 'Either listingId or destinationUrl is required' }, { status: 400 });
    }

    if (chargeAmountCents < 100) {
      return NextResponse.json({ error: 'Minimum charge amount is $1.00 (100 cents)' }, { status: 400 });
    }

    if (!listing && chargeAmountCents < MINIMUM_BID_CENTS) {
      return NextResponse.json({ error: 'Minimum bid amount is $2 (200 cents)' }, { status: 400 });
    }

    // 3. Create pending Bid record
    const pendingBid = await prisma.bid.create({
      data: {
        listingId: listing.id,
        amount: chargeAmountCents,
        previousBid: currentVerifiedBidCents,
        newTotalBid: finalTargetTotalCents,
        currency: 'USD',
        paymentProvider: 'razorpay',
        status: 'pending',
        bidderEmail: data.bidderEmail || null,
      },
    });

    // 4. Create Razorpay Checkout Order Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${appUrl}/bid/success?session_id=${pendingBid.id}&listing_id=${listing.id}&bid_id=${pendingBid.id}`;
    const cancelUrl = `${appUrl}/bid/cancelled?listing_id=${listing.id}`;

    const checkoutSession = await razorpayProvider.createCheckoutSession({
      listingId: listing.id,
      bidId: pendingBid.id,
      title: listing.title,
      chargeAmountCents,
      targetTotalBidCents: finalTargetTotalCents,
      canonicalUrl: listing.canonicalUrl,
      customerEmail: data.bidderEmail || undefined,
      successUrl,
      cancelUrl,
    });

    // Save session ID on the pending bid
    await prisma.bid.update({
      where: { id: pendingBid.id },
      data: { paymentId: checkoutSession.sessionId },
    });

    return NextResponse.json({
      success: true,
      provider: 'razorpay',
      checkoutUrl: checkoutSession.checkoutUrl,
      sessionId: checkoutSession.sessionId,
      orderId: checkoutSession.orderId || checkoutSession.sessionId,
      keyId: checkoutSession.keyId,
      amount: chargeAmountCents,
      currency: checkoutSession.currency || 'USD',
      listingId: listing.id,
      listingTitle: listing.title,
      countryCode: listing.countryCode,
      bidId: pendingBid.id,
      chargeAmountCents,
      targetTotalBidCents: finalTargetTotalCents,
      currentVerifiedBidCents,
    });
  } catch (error) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal checkout creation error' },
      { status: 500 }
    );
  }
}
