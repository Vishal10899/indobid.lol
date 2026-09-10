import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { calculateTrendingScore } from '../trending';
import { formatINR, MINIMUM_DEBATE_PAISE, MINIMUM_INCREMENT_PAISE, calculateNextMinimumPaise } from '../money';
import { CREATOR_SHARE_BPS } from '../creator-economics';

export interface FulfillmentParams {
  providerPaymentId: string;
  debateId?: string;
  contributionId?: string;
  listingId?: string; // legacy support
  bidId?: string; // legacy support
  amountPaise: number;
  currency?: string;
  baseAmount?: number;
  baseCurrency?: string;
  countryCode?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  provider?: string;
}

export interface FulfillmentResult {
  success: boolean;
  alreadyProcessed: boolean;
  debateId?: string;
  contributionId?: string;
  totalVerifiedContribution?: number;
  contributionCount?: number;
  lastContributionAmount?: number;
  error?: string;
}

/**
 * Authoritative, Idempotent Payment Fulfillment
 * Uses ACID database transaction with duplicate protection and strict monetary validation
 */
export async function processSuccessfulPayment(params: FulfillmentParams): Promise<FulfillmentResult> {
  const {
    providerPaymentId,
    debateId,
    contributionId,
    listingId,
    amountPaise,
    currency = 'INR',
    customerEmail,
    metadata = {},
    provider = 'razorpay',
  } = params;

  if (!providerPaymentId || providerPaymentId.trim() === '') {
    throw new Error('providerPaymentId is required for payment fulfillment');
  }
  if (typeof amountPaise !== 'number' || amountPaise <= 0 || isNaN(amountPaise)) {
    throw new Error('amountPaise must be a positive integer in paise');
  }

  // Strict Currency Verification: Enforce INR
  const normalizedCurrency = (currency || '').trim().toUpperCase();
  if (normalizedCurrency !== 'INR' && normalizedCurrency !== 'USD') {
    throw new Error(`Invalid payment currency: expected 'INR', received '${currency}'. Payment rejected.`);
  }

  // 1. Fast-path Idempotency Check
  const existingPayment = await prisma.payment.findUnique({
    where: { providerPaymentId },
    include: { debate: true, contribution: true },
  });

  if (existingPayment && existingPayment.status === 'succeeded') {
    return {
      success: true,
      alreadyProcessed: true,
      debateId: existingPayment.debateId || undefined,
      contributionId: existingPayment.contributionId || undefined,
      totalVerifiedContribution: existingPayment.debate?.totalVerifiedContribution,
      contributionCount: existingPayment.debate?.contributionCount,
      lastContributionAmount: existingPayment.debate?.lastContributionAmount,
    };
  }

  // 2. Execute ACID database transaction
  const result = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // Re-check inside transaction to prevent race conditions
      const txPaymentCheck = await tx.payment.findUnique({
        where: { providerPaymentId },
        include: { debate: true, contribution: true },
      });

      if (txPaymentCheck && txPaymentCheck.status === 'succeeded') {
        return {
          alreadyProcessed: true,
          debateId: txPaymentCheck.debateId || undefined,
          contributionId: txPaymentCheck.contributionId || undefined,
          totalVerifiedContribution: txPaymentCheck.debate?.totalVerifiedContribution,
          contributionCount: txPaymentCheck.debate?.contributionCount,
          lastContributionAmount: txPaymentCheck.debate?.lastContributionAmount,
        };
      }

      // CASE A: Debate / Contribution Fulfillment
      if (debateId) {
        const debate = await tx.debate.findUnique({
          where: { id: debateId },
          include: { category: true },
        });

        if (!debate) {
          throw new Error(`Debate ${debateId} not found`);
        }

        const now = new Date();
        const isNewDebate = debate.status === 'pending_payment' && debate.contributionCount === 0;

        if (isNewDebate) {
          // Minimum $2 USD (200 paise) for new debate
          if (amountPaise < MINIMUM_DEBATE_PAISE) {
            throw new Error(`New debate requires at least ${formatINR(MINIMUM_DEBATE_PAISE)}. Received ${formatINR(amountPaise)}.`);
          }

          // 1. Activate Debate
          const updatedDebate = await tx.debate.update({
            where: { id: debateId },
            data: {
              status: 'active',
              originalContribution: amountPaise,
              totalVerifiedContribution: amountPaise,
              contributionCount: 1,
              lastContributionAmount: amountPaise,
              lastContributionAt: now,
            },
          });

          // 2. Activate or Create original contribution (sequence = 1)
          let activeContribId = contributionId;
          if (contributionId) {
            const existingContrib = await tx.contribution.findUnique({ where: { id: contributionId } });
            if (existingContrib) {
              await tx.contribution.update({
                where: { id: contributionId },
                data: {
                  status: 'verified',
                  amount: amountPaise,
                  sequence: 1,
                  verifiedAt: now,
                  providerPaymentId,
                },
              });
            } else {
              const created = await tx.contribution.create({
                data: {
                  id: contributionId,
                  debateId,
                  amount: amountPaise,
                  content: debate.content,
                  sequence: 1,
                  status: 'verified',
                  authorUsername: debate.authorUsername,
                  authorDisplayName: debate.authorDisplayName,
                  providerPaymentId,
                  verifiedAt: now,
                },
              });
              activeContribId = created.id;
            }
          } else {
            // Check if there is an existing pending contribution
            const existingPending = await tx.contribution.findFirst({
              where: { debateId, sequence: 1 },
            });
            if (existingPending) {
              await tx.contribution.update({
                where: { id: existingPending.id },
                data: {
                  status: 'verified',
                  amount: amountPaise,
                  verifiedAt: now,
                  providerPaymentId,
                },
              });
              activeContribId = existingPending.id;
            } else {
              const created = await tx.contribution.create({
                data: {
                  debateId,
                  amount: amountPaise,
                  content: debate.content,
                  sequence: 1,
                  status: 'verified',
                  authorUsername: debate.authorUsername,
                  authorDisplayName: debate.authorDisplayName,
                  providerPaymentId,
                  verifiedAt: now,
                },
              });
              activeContribId = created.id;
            }
          }

          // 3. Upsert Payment Record
          await tx.payment.upsert({
            where: { providerPaymentId },
            create: {
              debateId,
              contributionId: activeContribId,
              provider,
              providerPaymentId,
              amount: amountPaise,
              currency,
              baseAmount: params.baseAmount || amountPaise,
              baseCurrency: params.baseCurrency || 'INR',
              countryCode: params.countryCode || 'IN',
              status: 'succeeded',
              customerEmail,
              metadata: JSON.stringify(metadata),
            },
            update: {
              status: 'succeeded',
              amount: amountPaise,
              baseAmount: params.baseAmount || amountPaise,
              baseCurrency: params.baseCurrency || 'INR',
              countryCode: params.countryCode || 'IN',
              metadata: JSON.stringify(metadata),
            },
          });

          // 4. Create Activity Event
          await tx.debateActivityEvent.create({
            data: {
              debateId,
              contributionId: activeContribId,
              type: 'new_debate',
              authorUsername: debate.authorUsername,
              authorDisplayName: debate.authorDisplayName,
              amount: amountPaise,
              title: debate.title,
              message: `@${debate.authorUsername} started a debate with ${formatINR(amountPaise)}`,
              createdAt: now,
            },
          });

          return {
            alreadyProcessed: false,
            debateId,
            contributionId: activeContribId,
            totalVerifiedContribution: updatedDebate.totalVerifiedContribution,
            contributionCount: updatedDebate.contributionCount,
            lastContributionAmount: updatedDebate.lastContributionAmount,
          };
        } else {
          // CONTINUING AN EXISTING DEBATE
          // Rule: amount >= calculateNextMinimumPaise(previousVerifiedContribution), min ₹10 (1000 paise)
          const minRequired = calculateNextMinimumPaise(debate.lastContributionAmount);
          if (amountPaise < minRequired) {
            throw new Error(
              `Insufficient contribution: must be at least ${formatINR(minRequired)} (previous was ${formatINR(debate.lastContributionAmount)}). Received ${formatINR(amountPaise)}.`
            );
          }

          const newSequence = debate.contributionCount + 1;
          const newTotal = debate.totalVerifiedContribution + amountPaise;

          // 1. Update or Create Contribution
          let activeContribId = contributionId;
          let contribAuthor = debate.authorUsername;
          let contribDisplayName = debate.authorDisplayName;
          let contribAuthorId = debate.authorId;

          if (contributionId) {
            const existingContrib = await tx.contribution.findUnique({ where: { id: contributionId } });
            if (existingContrib) {
              contribAuthor = existingContrib.authorUsername;
              contribDisplayName = existingContrib.authorDisplayName;
              contribAuthorId = existingContrib.authorId;
              await tx.contribution.update({
                where: { id: contributionId },
                data: {
                  status: 'verified',
                  amount: amountPaise,
                  sequence: newSequence,
                  verifiedAt: now,
                  providerPaymentId,
                },
              });
            } else {
              const created = await tx.contribution.create({
                data: {
                  id: contributionId,
                  debateId,
                  amount: amountPaise,
                  content: metadata.content || 'Continued debate',
                  sequence: newSequence,
                  status: 'verified',
                  authorUsername: metadata.authorUsername || 'anonymous',
                  authorDisplayName: metadata.authorDisplayName || 'Debater',
                  providerPaymentId,
                  verifiedAt: now,
                },
              });
              activeContribId = created.id;
              contribAuthor = created.authorUsername;
              contribDisplayName = created.authorDisplayName;
            }
          } else {
            const created = await tx.contribution.create({
              data: {
                debateId,
                amount: amountPaise,
                content: metadata.content || 'Continued debate',
                sequence: newSequence,
                status: 'verified',
                authorUsername: metadata.authorUsername || 'anonymous',
                authorDisplayName: metadata.authorDisplayName || 'Debater',
                providerPaymentId,
                verifiedAt: now,
              },
            });
            activeContribId = created.id;
            contribAuthor = created.authorUsername;
            contribDisplayName = created.authorDisplayName;
          }

          // 2. Update Debate Totals & Last Contribution
          const updatedDebate = await tx.debate.update({
            where: { id: debateId },
            data: {
              totalVerifiedContribution: newTotal,
              contributionCount: newSequence,
              lastContributionAmount: amountPaise,
              lastContributionAt: now,
              status: debate.status === 'hidden' ? 'hidden' : 'active',
            },
          });

          // 3. Upsert Payment Record
          await tx.payment.upsert({
            where: { providerPaymentId },
            create: {
              debateId,
              contributionId: activeContribId,
              provider,
              providerPaymentId,
              amount: amountPaise,
              currency,
              baseAmount: params.baseAmount || amountPaise,
              baseCurrency: params.baseCurrency || 'INR',
              countryCode: params.countryCode || 'IN',
              status: 'succeeded',
              customerEmail,
              metadata: JSON.stringify(metadata),
            },
            update: {
              status: 'succeeded',
              amount: amountPaise,
              baseAmount: params.baseAmount || amountPaise,
              baseCurrency: params.baseCurrency || 'INR',
              countryCode: params.countryCode || 'IN',
              metadata: JSON.stringify(metadata),
            },
          });

          // 4. Record Immutable Creator Earnings Ledger Entry (50% reward for external backers)
          const isExternalChallenger = (contribAuthor || '').toLowerCase().trim() !== (debate.authorUsername || '').toLowerCase().trim();
          if (isExternalChallenger && activeContribId) {
            const percentageBps = CREATOR_SHARE_BPS; // 50% rate
            const creatorRewardPaise = Math.floor((amountPaise * percentageBps) / 10000);
            const platformFeePaise = amountPaise - creatorRewardPaise;

            await tx.creatorEarningsLedger.upsert({
              where: { contributionId: activeContribId },
              create: {
                creatorId: debate.authorId,
                creatorUsername: debate.authorUsername,
                debateId,
                contributionId: activeContribId,
                grossAmountPaise: amountPaise,
                creatorRewardPaise,
                platformFeePaise,
                percentageBps,
                status: 'pending',
                idempotencyKey: `reward_${activeContribId}`,
                createdAt: now,
                settledAt: now,
              },
              update: {
                grossAmountPaise: amountPaise,
                creatorRewardPaise,
                platformFeePaise,
              },
            });
          }

          // 5. Create Activity Event
          await tx.debateActivityEvent.create({
            data: {
              debateId,
              contributionId: activeContribId,
              type: 'continued_debate',
              authorUsername: contribAuthor,
              authorDisplayName: contribDisplayName,
              amount: amountPaise,
              title: debate.title,
              message: `@${contribAuthor} continued the debate with ${formatINR(amountPaise)}`,
              createdAt: now,
            },
          });

          // 6. Notify Debate Author if authorId exists and not own continuation
          if (debate.authorId && debate.authorId !== contribAuthorId) {
            await tx.notification.create({
              data: {
                userId: debate.authorId,
                actorId: contribAuthorId,
                type: 'continuation',
                title: 'Opinion Continued',
                message: `${contribDisplayName} backed your opinion with ${formatINR(amountPaise)}. You earned ${formatINR(Math.floor((amountPaise * 1000) / 10000))} (10%).`,
                linkUrl: `/debate/${debateId}`,
              },
            }).catch(() => {});
          }

          return {
            alreadyProcessed: false,
            debateId,
            contributionId: activeContribId,
            totalVerifiedContribution: updatedDebate.totalVerifiedContribution,
            contributionCount: updatedDebate.contributionCount,
            lastContributionAmount: updatedDebate.lastContributionAmount,
          };
        }
      }

      // CASE B: Legacy Listing / Bid support (if needed)
      if (listingId) {
        const listing = await tx.listing.findUnique({ where: { id: listingId } });
        if (listing) {
          const newVerifiedBid = listing.verifiedBid + amountPaise;
          await tx.listing.update({
            where: { id: listingId },
            data: { verifiedBid: newVerifiedBid, status: 'active', bidReachedAt: new Date() },
          });
          await tx.payment.upsert({
            where: { providerPaymentId },
            create: {
              listingId,
              provider,
              providerPaymentId,
              amount: amountPaise,
              currency,
              status: 'succeeded',
              metadata: JSON.stringify(metadata),
            },
            update: { status: 'succeeded', amount: amountPaise },
          });
          return { alreadyProcessed: false, totalVerifiedContribution: newVerifiedBid };
        }
      }

      throw new Error('Either debateId or listingId is required for payment fulfillment');
    },
    {
      maxWait: 20000,
      timeout: 60000,
    }
  );

  // Recalculate trending score outside the transaction
  if (result.debateId) {
    try {
      const debate = await prisma.debate.findUnique({
        where: { id: result.debateId },
        include: {
          contributions: {
            where: { status: 'verified' },
            select: { amount: true, authorUsername: true, createdAt: true },
          },
        },
      });

      if (debate && debate.status === 'active') {
        const now = Date.now();
        const ms24h = 24 * 60 * 60 * 1000;
        const ms7d = 7 * 24 * 60 * 60 * 1000;
        let recent24h = 0;
        let recent7d = 0;
        const participants = new Set<string>();
        participants.add(debate.authorUsername.toLowerCase());

        for (const c of debate.contributions) {
          const age = now - new Date(c.createdAt).getTime();
          if (age <= ms24h) recent24h += c.amount;
          if (age <= ms7d) recent7d += c.amount;
          if (c.authorUsername) participants.add(c.authorUsername.toLowerCase());
        }

        const score = calculateTrendingScore({
          totalVerifiedPaise: debate.totalVerifiedContribution,
          recent24hVerifiedPaise: recent24h,
          recent7dVerifiedPaise: recent7d,
          contributionCount: debate.contributionCount,
          uniqueParticipants: participants.size,
          lastContributionAt: debate.lastContributionAt,
          createdAt: debate.createdAt,
        });

        await prisma.debate.update({
          where: { id: debate.id },
          data: { trendingScore: score },
        });
      }
    } catch (e) {
      console.error('Failed to update trending score after fulfillment:', e);
    }
  }

  return {
    success: true,
    ...result,
  };
}

/**
 * INDOBID — TRANSACTIONAL REFUND FULFILLMENT
 * Reverses payment, deducts debate verified contribution, marks contribution refunded,
 * and reverses creator earnings ledger entry in a single ACID transaction.
 */
export async function processRefundedPayment(
  paramsOrPaymentId:
    | string
    | {
        providerPaymentId: string;
        amountPaise?: number;
        debateId?: string;
        contributionId?: string;
        reason?: string;
      },
  reasonArg?: string
): Promise<{
  success: boolean;
  alreadyRefunded?: boolean;
  newVerifiedContribution?: number;
}> {
  let providerPaymentId: string;
  let amountPaise: number | undefined;
  let debateId: string | undefined;
  let contributionId: string | undefined;
  let reason = 'Payment refunded';

  if (typeof paramsOrPaymentId === 'string') {
    providerPaymentId = paramsOrPaymentId;
    reason = reasonArg || 'Payment refunded';
  } else if (paramsOrPaymentId && typeof paramsOrPaymentId === 'object') {
    providerPaymentId =
      paramsOrPaymentId.providerPaymentId ||
      (paramsOrPaymentId as any).paymentId ||
      (paramsOrPaymentId as any).id;
    amountPaise = paramsOrPaymentId.amountPaise;
    debateId = paramsOrPaymentId.debateId;
    contributionId = paramsOrPaymentId.contributionId;
    reason = paramsOrPaymentId.reason || reasonArg || 'Payment refunded';
  } else {
    throw new Error(`processRefundedPayment received invalid argument: ${JSON.stringify(paramsOrPaymentId)}`);
  }

  if (!providerPaymentId) {
    throw new Error(`processRefundedPayment: providerPaymentId could not be resolved from: ${JSON.stringify(paramsOrPaymentId)}`);
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const payment = await tx.payment.findUnique({
      where: { providerPaymentId },
      include: { debate: true, contribution: true },
    });

    if (!payment) {
      throw new Error(`Payment ${providerPaymentId} not found`);
    }

    if (payment.status === 'refunded') {
      return {
        alreadyRefunded: true,
        newVerifiedContribution: payment.debate?.totalVerifiedContribution || 0,
      };
    }

    // 1. Mark payment refunded
    await tx.payment.update({
      where: { providerPaymentId },
      data: { status: 'refunded' },
    });

    // 2. Mark contribution refunded and reverse creator ledger entry
    const targetContributionId = contributionId || payment.contributionId;
    if (targetContributionId) {
      await tx.contribution.updateMany({
        where: { id: targetContributionId },
        data: { status: 'refunded' },
      });

      await tx.creatorEarningsLedger.updateMany({
        where: { contributionId: targetContributionId },
        data: {
          status: 'reversed',
          reversedAt: new Date(),
          reversalReason: reason,
        },
      });
    }

    // 3. Decrement debate totalVerifiedContribution
    const targetDebateId = debateId || payment.debateId;
    let newVerifiedTotal = 0;
    if (targetDebateId) {
      const debate = await tx.debate.findUnique({ where: { id: targetDebateId } });
      if (debate) {
        const deductionPaise = amountPaise !== undefined ? amountPaise : (payment.amount || 0);
        newVerifiedTotal = Math.max(0, debate.totalVerifiedContribution - deductionPaise);
        await tx.debate.update({
          where: { id: targetDebateId },
          data: {
            totalVerifiedContribution: newVerifiedTotal,
          },
        });
      }
    }

    return {
      alreadyRefunded: false,
      newVerifiedContribution: newVerifiedTotal,
      debateId: targetDebateId,
    };
  }, {
    maxWait: 20000,
    timeout: 60000,
  });

  // 4. Recalculate trending score outside transaction
  if (result.debateId) {
    try {
      const debate = await prisma.debate.findUnique({
        where: { id: result.debateId },
        include: {
          contributions: {
            where: { status: 'verified' },
            select: { amount: true, authorUsername: true, createdAt: true },
          },
        },
      });

      if (debate) {
        const score = calculateTrendingScore({
          totalVerifiedPaise: debate.totalVerifiedContribution,
          contributionCount: debate.contributions.length,
          lastContributionAt: debate.lastContributionAt,
          createdAt: debate.createdAt,
        });

        await prisma.debate.update({
          where: { id: debate.id },
          data: { trendingScore: score },
        });
      }
    } catch (err) {
      console.error('Failed to recalculate trending score after refund:', err);
    }
  }

  return {
    success: true,
    alreadyRefunded: result.alreadyRefunded,
    newVerifiedContribution: result.newVerifiedContribution,
  };
}

