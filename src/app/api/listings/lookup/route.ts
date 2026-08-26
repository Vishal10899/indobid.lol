import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateAndFormatUrl, normalizeCanonicalUrl, detectDestinationType } from '@/lib/url-utils';
import { z } from 'zod';

const lookupSchema = z.object({
  url: z.string().min(1, 'URL is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { isValid, formattedUrl, error } = validateAndFormatUrl(parsed.data.url);
    if (!isValid) {
      return NextResponse.json({ error: error || 'Invalid URL format' }, { status: 400 });
    }

    const canonicalUrl = normalizeCanonicalUrl(formattedUrl);
    const destinationType = detectDestinationType(formattedUrl);

    const existing = await prisma.listing.findUnique({
      where: { canonicalUrl },
      include: { category: true },
    });

    if (existing) {
      return NextResponse.json({
        exists: true,
        canonicalUrl,
        formattedUrl,
        destinationType: existing.destinationType || destinationType,
        listing: {
          id: existing.id,
          title: existing.title,
          description: existing.description,
          logoUrl: existing.logoUrl,
          categoryId: existing.categoryId,
          categoryName: existing.category.name,
          categorySlug: existing.category.slug,
          verifiedBid: existing.verifiedBid,
          clickCount: existing.clickCount,
          status: existing.status,
          socialWebsite: existing.socialWebsite,
          socialInstagram: existing.socialInstagram,
          socialYoutube: existing.socialYoutube,
          socialX: existing.socialX,
        },
      });
    }

    return NextResponse.json({
      exists: false,
      canonicalUrl,
      formattedUrl,
      destinationType,
      listing: null,
    });
  } catch (error) {
    console.error('Error looking up listing by URL:', error);
    return NextResponse.json({ error: 'Failed to look up destination URL' }, { status: 500 });
  }
}
