import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getListingRanks } from '@/lib/ranking';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id') || searchParams.get('order_id') || '';
    const paymentId = searchParams.get('payment_id') || '';
    const bidId = searchParams.get('bid_id') || '';
    const listingId = searchParams.get('listing_id') || '';

    if (!sessionId && !listingId && !bidId && !paymentId) {
      return NextResponse.json({ error: 'Identification parameter required' }, { status: 400 });
    }

    // 1. Check payment confirmation by paymentId / sessionId
    let payment = null;
    if (paymentId) {
      payment = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentId },
        include: { listing: { include: { category: true } } },
      });
    }

    if (!payment && sessionId) {
      payment = await prisma.payment.findUnique({
        where: { providerPaymentId: sessionId },
        include: { listing: { include: { category: true } } },
      });
    }

    if (!payment && bidId) {
      payment = await prisma.payment.findFirst({
        where: { bidId, status: 'succeeded' },
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

    // 2. Check if bid itself is completed
    if (bidId) {
      const bid = await prisma.bid.findUnique({
        where: { id: bidId },
        include: { listing: { include: { category: true } } },
      });

      if (bid && bid.status === 'completed') {
        const ranks = await getListingRanks(bid.listingId);
        return NextResponse.json({
          verified: true,
          listing: {
            id: bid.listing.id,
            title: bid.listing.title,
            description: bid.listing.description,
            destinationUrl: bid.listing.destinationUrl,
            canonicalUrl: bid.listing.canonicalUrl,
            destinationType: bid.listing.destinationType,
            logoUrl: bid.listing.logoUrl,
            categoryName: bid.listing.category.name,
            categorySlug: bid.listing.category.slug,
            verifiedBid: bid.listing.verifiedBid,
          },
          globalRank: ranks.globalRank,
          categoryRank: ranks.categoryRank,
          verifiedBidCents: bid.listing.verifiedBid,
          amountPaidCents: bid.amount,
        });
      }
    }

    // 3. If listingId provided, check if listing has verified bids
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
