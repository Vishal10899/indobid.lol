import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/auth';
import { validateAndFormatUrl, normalizeCanonicalUrl, detectDestinationType, sanitizeText } from '@/lib/url-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const query = searchParams.get('q') || undefined;

    const listings = await prisma.listing.findMany({
      where: {
        status: status ? status : undefined,
        OR: query
          ? [
              { title: { contains: query } },
              { canonicalUrl: { contains: query } },
              { description: { contains: query } },
            ]
          : undefined,
      },
      orderBy: [
        { verifiedBid: 'desc' },
        { bidReachedAt: 'asc' },
      ],
      include: {
        category: true,
        _count: {
          select: { bids: true, payments: true, clicks: true },
        },
      },
    });

    return NextResponse.json({ listings });
  } catch (error) {
    console.error('Admin listings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch admin listings' }, { status: 500 });
  }
}

const createSpecialListingSchema = z.object({
  destinationUrl: z.string().min(1, 'Destination URL is required'),
  title: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  categoryId: z.string().min(1, 'Category ID is required'),
  countryCode: z.string().optional().nullable(),
  verifiedBidDollars: z.number().int().positive('Displayed bid must be greater than 0'),
  logoUrl: z.string().optional().nullable(),
  socialWebsite: z.string().optional().nullable(),
  socialInstagram: z.string().optional().nullable(),
  socialYoutube: z.string().optional().nullable(),
  socialX: z.string().optional().nullable(),
});

/**
 * ADMIN-ONLY Special / Promotional Listing Creation
 * - Requires verified admin authentication
 * - Creates active listing with displayed verifiedBid
 * - Explicitly marks listing as isSpecial = true (Admin Promotional)
 * - Creates ZERO fake payment or revenue records
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSpecialListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const { isValid, formattedUrl, error: urlError } = validateAndFormatUrl(data.destinationUrl);
    if (!isValid) {
      return NextResponse.json({ error: urlError || 'Invalid destination URL' }, { status: 400 });
    }

    const canonicalUrl = normalizeCanonicalUrl(formattedUrl);
    const destinationType = detectDestinationType(formattedUrl);

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      return NextResponse.json({ error: 'Selected category does not exist' }, { status: 400 });
    }

    const verifiedBidCents = data.verifiedBidDollars * 100;
    const defaultTitle = new URL(formattedUrl).hostname.replace(/^www\./, '');
    const defaultDesc = `Promotional listing for ${formattedUrl}`;

    // Upsert listing with isSpecial: true
    const listing = await prisma.listing.upsert({
      where: { canonicalUrl },
      update: {
        title: sanitizeText(data.title || defaultTitle, 100),
        description: sanitizeText(data.description || defaultDesc, 500),
        categoryId: data.categoryId,
        destinationUrl: formattedUrl,
        destinationType,
        verifiedBid: verifiedBidCents,
        status: 'active',
        isSpecial: true,
        countryCode: data.countryCode ? data.countryCode.trim().toUpperCase() : 'IN',
        logoUrl: data.logoUrl ? sanitizeText(data.logoUrl, 500) : undefined,
        socialWebsite: data.socialWebsite ? sanitizeText(data.socialWebsite, 300) : undefined,
        socialInstagram: data.socialInstagram ? sanitizeText(data.socialInstagram, 300) : undefined,
        socialYoutube: data.socialYoutube ? sanitizeText(data.socialYoutube, 300) : undefined,
        socialX: data.socialX ? sanitizeText(data.socialX, 300) : undefined,
      },
      create: {
        destinationUrl: formattedUrl,
        canonicalUrl,
        destinationType,
        title: sanitizeText(data.title || defaultTitle, 100),
        description: sanitizeText(data.description || defaultDesc, 500),
        categoryId: data.categoryId,
        verifiedBid: verifiedBidCents,
        status: 'active',
        isSpecial: true,
        countryCode: data.countryCode ? data.countryCode.trim().toUpperCase() : 'IN',
        logoUrl: data.logoUrl ? sanitizeText(data.logoUrl, 500) : null,
        socialWebsite: data.socialWebsite ? sanitizeText(data.socialWebsite, 300) : null,
        socialInstagram: data.socialInstagram ? sanitizeText(data.socialInstagram, 300) : null,
        socialYoutube: data.socialYoutube ? sanitizeText(data.socialYoutube, 300) : null,
        socialX: data.socialX ? sanitizeText(data.socialX, 300) : null,
      },
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      listing,
      message: 'Admin promotional listing created successfully with zero fake revenue records.',
    });
  } catch (error) {
    console.error('Admin special listing error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create promotional listing' },
      { status: 500 }
    );
  }
}

const updateListingSchema = z.object({
  id: z.string().min(1, 'Listing ID is required'),
  status: z.enum(['active', 'hidden', 'flagged', 'pending_payment']).optional(),
  categoryId: z.string().optional(),
  countryCode: z.string().optional().nullable(),
  title: z.string().optional(),
  description: z.string().optional(),
  verifiedBidDollars: z.number().int().nonnegative().optional(),
});

export async function PATCH(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { id, status, categoryId, countryCode, title, description, verifiedBidDollars } = parsed.data;

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        status: status || undefined,
        categoryId: categoryId || undefined,
        countryCode: countryCode ? countryCode.trim().toUpperCase() : undefined,
        title: title || undefined,
        description: description || undefined,
        verifiedBid: verifiedBidDollars !== undefined ? verifiedBidDollars * 100 : undefined,
      },
      include: { category: true },
    });

    return NextResponse.json({ success: true, listing: updated });
  } catch (error) {
    console.error('Admin listing update error:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
}
