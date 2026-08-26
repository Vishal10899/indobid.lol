import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getListingRanks } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');
    const listingId = searchParams.get('listing_id');

    if (!sessionId && !listingId) {
      return NextResponse.json({ error: 'session_id or listing_id required' }, { status: 400 });
    }

    // Check payment confirmation by sessionId
    let payment = null;
    if (sessionId) {
      payment = await prisma.payment.findUnique({
        where: { providerPaymentId: sessionId },
        include: { listing: { include: { category: true } } },
      });
    }

    if (payment && payment.status === 'succeeded') {
      const ranks = await getListingRanks(payment.listingId);
      return NextResponse.json({
        verified: true,
        listing: {
          id: payment.listing.id,
          title: payment.listing.title,
          description: payment.listing.description,
          destinationUrl: payment.listing.destinationUrl,
          canonicalUrl: payment.listing.canonicalUrl,
          destinationType: payment.listing.destinationType,
          logoUrl: payment.listing.logoUrl,
          categoryName: payment.listing.category.name,
          categorySlug: payment.listing.category.slug,
          verifiedBid: payment.listing.verifiedBid,
        },
        globalRank: ranks.globalRank,
        categoryRank: ranks.categoryRank,
        verifiedBidCents: payment.listing.verifiedBid,
        amountPaidCents: payment.amount,
      });
    }

    // If listingId provided, check if listing is already verified
    if (listingId) {
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: { category: true },
      });

      if (listing && listing.verifiedBid > 0) {
        const ranks = await getListingRanks(listing.id);
        return NextResponse.json({
          verified: true,
          listing: {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            destinationUrl: listing.destinationUrl,
            canonicalUrl: listing.canonicalUrl,
            destinationType: listing.destinationType,
            logoUrl: listing.logoUrl,
            categoryName: listing.category.name,
            categorySlug: listing.category.slug,
            verifiedBid: listing.verifiedBid,
          },
          globalRank: ranks.globalRank,
          categoryRank: ranks.categoryRank,
          verifiedBidCents: listing.verifiedBid,
          amountPaidCents: 0,
        });
      }
    }

    return NextResponse.json({
      verified: false,
      status: 'processing',
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Failed to check payment status' }, { status: 500 });
  }
}
