import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/auth';
import { getAdminVisitorAnalytics, getTopVisitedListings } from '@/lib/visitor-tracker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    // 1. Listing metrics
    const [
      totalListings,
      activeListings,
      pendingPaymentListings,
      hiddenListings,
      specialListings,
    ] = await Promise.all([
      prisma.listing.count(),
      prisma.listing.count({ where: { status: 'active' } }),
      prisma.listing.count({ where: { status: 'pending_payment' } }),
      prisma.listing.count({ where: { status: 'hidden' } }),
      prisma.listing.count({ where: { isSpecial: true } }),
    ]);

    // 2. Verified bids sum (cents)
    const verifiedBidsAgg = await prisma.listing.aggregate({
      _sum: { verifiedBid: true },
      where: { status: 'active', verifiedBid: { gt: 0 } },
    });
    const totalVerifiedBidsCents = verifiedBidsAgg._sum.verifiedBid || 0;

    // 3. Real verified revenue (calculated EXCLUSIVELY from Payment records with status: 'succeeded')
    const revenueAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'succeeded' },
    });
    const totalRevenueCents = revenueAgg._sum.amount || 0;

    // 4. Payment breakdown
    const [
      totalPayments,
      successfulPayments,
      failedPayments,
      canceledPayments,
    ] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'succeeded' } }),
      prisma.payment.count({ where: { status: 'failed' } }),
      prisma.payment.count({ where: { status: 'canceled' } }),
    ]);

    // 5. Bid attempt records breakdown
    const [
      totalBids,
      completedBids,
      failedBids,
      canceledBids,
      pendingBids,
    ] = await Promise.all([
      prisma.bid.count(),
      prisma.bid.count({ where: { status: 'completed' } }),
      prisma.bid.count({ where: { status: 'failed' } }),
      prisma.bid.count({ where: { status: 'canceled' } }),
      prisma.bid.count({ where: { status: 'pending' } }),
    ]);

    // 6. User and Traffic metrics & Real Visitor Analytics
    const [totalUsers, totalClicks, visitorAnalytics, topVisitedListings] = await Promise.all([
      prisma.user.count(),
      prisma.click.count(),
      getAdminVisitorAnalytics(5),
      getTopVisitedListings(10),
    ]);

    // 7. Category distribution
    const categoriesWithCount = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            listings: {
              where: { status: 'active', verifiedBid: { gt: 0 } },
            },
          },
        },
      },
    });

    // 8. Recent activity lists
    const [recentListings, recentPayments, recentBids] = await Promise.all([
      prisma.listing.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      prisma.payment.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: { id: true, title: true, canonicalUrl: true },
          },
        },
      }),
      prisma.bid.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          listing: {
            select: { id: true, title: true, canonicalUrl: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      metrics: {
        listings: {
          total: totalListings,
          active: activeListings,
          pendingPayment: pendingPaymentListings,
          hidden: hiddenListings,
          specialPromotional: specialListings,
        },
        financials: {
          totalRevenueDollars: totalRevenueCents / 100,
          totalRevenueCents,
          totalVerifiedBidsDollars: totalVerifiedBidsCents / 100,
          totalVerifiedBidsCents,
          currency: 'USD',
        },
        payments: {
          total: totalPayments,
          successful: successfulPayments,
          failed: failedPayments,
          canceled: canceledPayments,
        },
        bids: {
          total: totalBids,
          completed: completedBids,
          pending: pendingBids,
          failed: failedBids,
          canceled: canceledBids,
        },
        users: {
          total: totalUsers,
        },
        traffic: {
          totalRecordedClicks: totalClicks,
          trafficModelNote: 'Tracks outbound clicks to listings deduplicated by IP hash (1 per hour).',
        },
        visitors: visitorAnalytics,
        topVisitedListings,
      },
      categories: categoriesWithCount.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        activeListingsCount: c._count.listings,
      })),
      recentListings,
      recentPayments,
      recentBids,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to aggregate admin statistics' }, { status: 500 });
  }
}
