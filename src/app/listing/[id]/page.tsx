import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getListingRanks, MINIMUM_INCREMENT_CENTS } from '@/lib/ranking';
import { ListingDetailClient } from './ListingDetailClient';

interface ListingPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; canceled?: string; session_id?: string }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!listing || listing.status !== 'active' || listing.verifiedBid <= 0) {
    return {
      title: 'Listing Not Found — indobid.lol',
    };
  }

  const ranks = await getListingRanks(listing.id);
  const formattedBid = `$${(listing.verifiedBid / 100).toLocaleString()}`;

  return {
    title: `${listing.title} — #${ranks.globalRank} on indobid.lol (${formattedBid})`,
    description: `${listing.description} Ranked #${ranks.globalRank} globally with ${formattedBid} verified bid.`,
    alternates: {
      canonical: `https://indobid.lol/listing/${listing.id}`,
    },
    openGraph: {
      title: `${listing.title} — #${ranks.globalRank} Rank on indobid.lol`,
      description: listing.description,
      url: `https://indobid.lol/listing/${listing.id}`,
      siteName: 'indobid.lol',
      images: listing.logoUrl ? [{ url: listing.logoUrl }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${listing.title} — #${ranks.globalRank} on indobid.lol`,
      description: listing.description,
      images: listing.logoUrl ? [listing.logoUrl] : [],
    },
  };
}

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const { id } = await params;
  const { success, canceled, session_id } = await searchParams;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      category: true,
      bids: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!listing || listing.status !== 'active' || listing.verifiedBid <= 0) {
    notFound();
  }

  const ranks = await getListingRanks(listing.id);
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  // Calculate minimum to outbid
  const minOutbidCents = listing.verifiedBid + MINIMUM_INCREMENT_CENTS;

  return (
    <ListingDetailClient
      listing={{
        id: listing.id,
        title: listing.title,
        description: listing.description,
        destinationUrl: listing.destinationUrl,
        canonicalUrl: listing.canonicalUrl,
        destinationType: listing.destinationType,
        logoUrl: listing.logoUrl,
        categoryId: listing.categoryId,
        categoryName: listing.category.name,
        categorySlug: listing.category.slug,
        verifiedBid: listing.verifiedBid,
        currency: listing.currency,
        countryCode: listing.countryCode,
        clickCount: listing.clickCount,
        visitCount: listing.visitCount,
        status: listing.status,
        socialWebsite: listing.socialWebsite,
        socialInstagram: listing.socialInstagram,
        socialYoutube: listing.socialYoutube,
        socialX: listing.socialX,
        createdAt: listing.createdAt.toISOString(),
        bidReachedAt: listing.bidReachedAt.toISOString(),
        globalRank: ranks.globalRank,
        categoryRank: ranks.categoryRank,
        minOutbidCents,
        bids: listing.bids.map((b) => ({
          id: b.id,
          amount: b.amount,
          previousBid: b.previousBid,
          newTotalBid: b.newTotalBid,
          createdAt: b.createdAt.toISOString(),
        })),
      }}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      }))}
      isPaymentSuccess={success === 'true'}
      isPaymentCanceled={canceled === 'true'}
      sessionId={session_id}
    />
  );
}
