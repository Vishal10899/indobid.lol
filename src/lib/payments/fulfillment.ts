import { prisma } from '../db';
import { Prisma } from '@prisma/client';

export interface FulfillmentParams {
  providerPaymentId: string;
  listingId: string;
  bidId?: string;
  amountCents: number;
  currency?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  provider?: string;
}

export interface FulfillmentResult {
  success: boolean;
  alreadyProcessed: boolean;
  listingId: string;
  newVerifiedBid: number;
  newRank: number;
  error?: string;
}

/**
 * Idempotent fulfillment of verified payments with atomic DB transaction
 */
export async function processSuccessfulPayment(params: FulfillmentParams): Promise<FulfillmentResult> {
  const {
    providerPaymentId,
    listingId,
    bidId,
    amountCents,
    currency = 'USD',
    customerEmail,
    metadata = {},
    provider = 'razorpay',
  } = params;

  if (!providerPaymentId || providerPaymentId.trim() === '') {
    throw new Error('providerPaymentId is required for payment fulfillment');
  }
  if (!listingId || listingId.trim() === '') {
    throw new Error('listingId is required for payment fulfillment');
  }
  if (typeof amountCents !== 'number' || amountCents <= 0 || isNaN(amountCents)) {
    throw new Error('amountCents must be a positive integer in cents');
  }

  // Strict USD Currency Verification: Reject any non-USD currency
  const normalizedCurrency = (currency || '').trim().toUpperCase();
  if (normalizedCurrency !== 'USD') {
    throw new Error(`Invalid payment currency: expected 'USD', received '${currency}'. Payment rejected.`);
  }

  // Backend Expected Amount Verification: Do not trust unverified client amounts
  if (bidId) {
    const expectedBid = await prisma.bid.findUnique({ where: { id: bidId } });
    if (expectedBid && expectedBid.amount > 0) {
      if (amountCents !== expectedBid.amount) {
        throw new Error(
          `Payment amount mismatch: expected ${expectedBid.amount} cents ($${expectedBid.amount / 100}), received ${amountCents} cents ($${amountCents / 100}). Payment rejected.`
        );
      }
    }
  }

  // Check if this payment was already processed (fast-path check)
  const existingPayment = await prisma.payment.findUnique({
    where: { providerPaymentId },
    include: { listing: true },
  });

  if (existingPayment && existingPayment.status === 'succeeded') {
    // Already fulfilled idempotently!
    const higherCount = await prisma.listing.count({
      where: {
        status: 'active',
        OR: [
          { verifiedBid: { gt: existingPayment.listing.verifiedBid } },
          {
            AND: [
              { verifiedBid: { equals: existingPayment.listing.verifiedBid } },
              { bidReachedAt: { lt: existingPayment.listing.bidReachedAt } },
            ],
          },
        ],
      },
    });

    return {
      success: true,
      alreadyProcessed: true,
      listingId: existingPayment.listingId,
      newVerifiedBid: existingPayment.listing.verifiedBid,
      newRank: higherCount + 1,
    };
  }

  // Execute ACID database transaction
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
    // Re-verify inside transaction to guard against concurrent webhook triggers
    const txPaymentCheck = await tx.payment.findUnique({
      where: { providerPaymentId },
      include: { listing: true },
    });

    if (txPaymentCheck && txPaymentCheck.status === 'succeeded') {
      const higherCount = await tx.listing.count({
        where: {
          status: 'active',
          OR: [
            { verifiedBid: { gt: txPaymentCheck.listing.verifiedBid } },
            {
              AND: [
                { verifiedBid: { equals: txPaymentCheck.listing.verifiedBid } },
                { bidReachedAt: { lt: txPaymentCheck.listing.bidReachedAt } },
              ],
            },
          ],
        },
      });
      return {
        alreadyProcessed: true,
        listingId: txPaymentCheck.listingId,
        newVerifiedBid: txPaymentCheck.listing.verifiedBid,
        newRank: higherCount + 1,
      };
    }

    // Fetch listing
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found`);
    }

    const previousBid = listing.verifiedBid;
    const newVerifiedBid = previousBid + amountCents;
    const now = new Date();

    // 1. Update listing verified bid & timestamp
    const updatedListing = await tx.listing.update({
      where: { id: listingId },
      data: {
        verifiedBid: newVerifiedBid,
        bidReachedAt: now,
        status: listing.status === 'hidden' ? 'hidden' : 'active',
      },
    });

    // 2. Update or create Bid
    let activeBidId = bidId;
    if (bidId) {
      const existingBid = await tx.bid.findUnique({ where: { id: bidId } });
      if (existingBid) {
        await tx.bid.update({
          where: { id: bidId },
          data: {
            status: 'completed',
            previousBid,
            newTotalBid: newVerifiedBid,
            amount: amountCents,
            bidderEmail: customerEmail || existingBid.bidderEmail,
          },
        });
      } else {
        const createdBid = await tx.bid.create({
          data: {
            id: bidId,
            listingId,
            amount: amountCents,
            previousBid,
            newTotalBid: newVerifiedBid,
            currency,
            paymentProvider: provider,
            paymentId: providerPaymentId,
            status: 'completed',
            bidderEmail: customerEmail,
          },
        });
        activeBidId = createdBid.id;
      }
    } else {
      const createdBid = await tx.bid.create({
        data: {
          listingId,
          amount: amountCents,
          previousBid,
          newTotalBid: newVerifiedBid,
          currency,
          paymentProvider: provider,
          paymentId: providerPaymentId,
          status: 'completed',
          bidderEmail: customerEmail,
        },
      });
      activeBidId = createdBid.id;
    }

    // 3. Create or update Payment record (idempotency key: providerPaymentId)
    await tx.payment.upsert({
      where: { providerPaymentId },
      create: {
        listingId,
        bidId: activeBidId,
        provider,
        providerPaymentId,
        amount: amountCents,
        currency,
        status: 'succeeded',
        metadata: JSON.stringify(metadata),
      },
      update: {
        status: 'succeeded',
        amount: amountCents,
        metadata: JSON.stringify(metadata),
      },
    });

    // 4. Calculate new rank
    const higherCount = await tx.listing.count({
      where: {
        status: 'active',
        OR: [
          { verifiedBid: { gt: newVerifiedBid } },
          {
            AND: [
              { verifiedBid: { equals: newVerifiedBid } },
              { bidReachedAt: { lt: now } },
            ],
          },
        ],
      },
    });
    const newRank = higherCount + 1;

    // 5. Create Activity Event
    let eventType = 'climbed_rank';
    let message = '';
    const formattedAmount = `$${(newVerifiedBid / 100).toLocaleString()}`;
    const formattedCharge = `$${(amountCents / 100).toLocaleString()}`;

    if (newRank === 1) {
      eventType = 'took_first';
      message = `${listing.title} took #1 with ${formattedAmount}`;
    } else if (previousBid === 0) {
      eventType = 'new_entry';
      message = `${listing.title} entered #${newRank} with ${formattedAmount}`;
    } else {
      eventType = 'climbed_rank';
      message = `${listing.title} boosted +${formattedCharge} and climbed to #${newRank} (${formattedAmount})`;
    }

    await tx.activityEvent.create({
      data: {
        listingId,
        type: eventType,
        title: listing.title,
        destinationType: listing.destinationType,
        amount: newVerifiedBid,
        rank: newRank,
        message,
        createdAt: now,
      },
    });

      return {
        alreadyProcessed: false,
        listingId: updatedListing.id,
        newVerifiedBid: updatedListing.verifiedBid,
        newRank,
      };
    },
    {
      maxWait: 10000,
      timeout: 20000,
    }
  );

  return {
    success: true,
    ...result,
  };
}
