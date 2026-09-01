import { prisma } from './db';
import { formatINR } from './money';

/**
 * INDOBID.LOL — AUTHORITATIVE CREATOR ECONOMICS & EARNINGS ENGINE
 * 
 * ACCOUNTING RULES & SEMANTICS (PRD v1.0 LOCKED):
 * 1. 50 / 50 Revenue Split (5000 basis points).
 *    For eligible external backing:
 *    - 50% allocated to Creator / eligible recipient pool
 *    - 50% allocated to IndoBid platform protocol
 *    Example:
 *    - 1000 paise (₹10)   -> 500 paise (₹5.00 creator) / 500 paise (₹5.00 platform)
 *    - 1100 paise (₹11)   -> 550 paise (₹5.50 creator) / 550 paise (₹5.50 platform)
 *    - 2000 paise (₹20)   -> 1000 paise (₹10.00 creator) / 1000 paise (₹10.00 platform)
 *    - 2500 paise (₹25)   -> 1250 paise (₹12.50 creator) / 1250 paise (₹12.50 platform)
 *    - 10000 paise (₹100) -> 5000 paise (₹50.00 creator) / 5000 paise (₹50.00 platform)
 * 
 * 2. Creator Initial Starting Payment (Sequence #1 / Origin):
 *    - Creator pays ₹10 minimum to publish the opinion.
 *    - Sequence #1 is stored as the first verified contribution and establishes the debate floor.
 *    - Creator self-contributions DO NOT generate creator rewards for themselves.
 *    - No double-counting: total backing is the sum of verified contribution records.
 * 
 * 3. Eligible External Backing:
 *    - Verified contributions where contributor != debate creator.
 * 
 * 4. Immutable Earnings Ledger & Webhook Idempotency:
 *    - Every reward creates an immutable record in `CreatorEarningsLedger` with unique `contributionId` and `idempotencyKey`.
 *    - Webhook delivered twice -> ONE contribution, ONE creator reward, NEVER two rewards.
 * 
 * 5. Refunds & Invalidation:
 *    - If a contribution is refunded/reversed, its ledger status transitions to 'reversed'.
 *    - The creator does not retain reward money from invalidated contributions.
 */

export const CREATOR_SHARE_BPS = 5000; // 50.00% (50/50 Revenue Split)
export const BPS_DENOMINATOR = 10000;

/**
 * Authoritative backend function to calculate creator reward in paise from a contribution amount.
 * 
 * @param amountPaise The gross contribution amount in paise (e.g. 2500 for ₹25)
 * @param rateBps Optional custom basis points (defaults to 5000 = 50%)
 * @returns creator reward in paise (e.g. 1250 for ₹12.50)
 */
export function calculateCreatorReward(
  amountPaise: number,
  rateBps: number = CREATOR_SHARE_BPS
): number {
  if (typeof amountPaise !== 'number' || amountPaise <= 0 || isNaN(amountPaise)) {
    return 0;
  }
  return Math.floor((amountPaise * rateBps) / BPS_DENOMINATOR);
}

export interface CreatorEconomicsBreakdown {
  userId?: string | null;
  username: string;
  debatesCount: number;
  totalVerifiedContributionsCount: number;
  
  // Total Backing Volume (Creator Initial + Self-Continuations + External Backers)
  totalBackingPaise: number;
  totalBackingRupees: number;
  formattedTotalBacking: string;

  // Creator's Own Staked Conviction (Sequence #1 Origin + Self-defense responses)
  creatorOwnStakePaise: number;
  creatorOwnStakeRupees: number;
  formattedCreatorOwnStake: string;

  // Eligible External Backing (3rd-party challenger responses)
  eligibleExternalBackingPaise: number;
  eligibleExternalBackingRupees: number;
  formattedEligibleExternalBacking: string;

  // Total Lifetime Creator Earnings (10% of eligible external backing)
  creatorEarningsPaise: number;
  creatorEarningsRupees: number;
  formattedCreatorEarnings: string;

  // Pending Earnings (within settlement window)
  pendingEarningsPaise: number;
  pendingEarningsRupees: number;
  formattedPendingEarnings: string;

  // Available Earnings (matured and ready for payout)
  availableEarningsPaise: number;
  availableEarningsRupees: number;
  formattedAvailableEarnings: string;

  // Disbursed / Paid Earnings
  paidEarningsPaise: number;
  paidEarningsRupees: number;
  formattedPaidEarnings: string;

  // Platform Protocol Fee (50%)
  platformFeePaise: number;
  platformFeeRupees: number;
  formattedPlatformFee: string;
}

export interface DebateRewardBreakdown {
  debateId: string;
  title: string;
  creatorUsername: string;
  isAnonymous: boolean;
  status: string;
  
  // Total verified backing on the debate
  totalVerifiedBackingPaise: number;
  formattedTotalBacking: string;

  // Creator Initial Origin Payment (Sequence 1)
  creatorInitialPaise: number;
  formattedCreatorInitial: string;

  // Creator Subsequent Backing (Self-continuations)
  creatorSelfContinuationsPaise: number;
  formattedCreatorSelfContinuations: string;

  // Eligible External Backing from other users
  eligibleExternalBackingPaise: number;
  formattedEligibleExternalBacking: string;

  // Creator Reward / Earnings generated from this debate (50%)
  creatorRewardPaise: number;
  formattedCreatorReward: string;

  // Platform Fee generated from this debate (50%)
  platformFeePaise: number;
  formattedPlatformFee: string;

  // Verified contribution counts
  contributionCount: number;
  externalContributionsCount: number;

  // Public display label (e.g. "₹500 backed · Creator pool: ₹250 (50%)")
  publicDisplayLabel: string;
}

/**
 * Calculate the reward breakdown for a single debate deterministically.
 */
export async function calculateDebateReward(
  debateId: string,
  rateBps: number = CREATOR_SHARE_BPS
): Promise<DebateRewardBreakdown | null> {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      contributions: {
        where: { status: 'verified' },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (!debate) return null;

  const creatorClean = debate.authorUsername.toLowerCase().trim();
  let creatorInitialPaise = 0;
  let creatorSelfContinuationsPaise = 0;
  let eligibleExternalBackingPaise = 0;
  let externalContributionsCount = 0;

  for (const c of debate.contributions) {
    const isCreator = (c.authorUsername || '').toLowerCase().trim() === creatorClean;
    if (isCreator) {
      if (c.sequence === 1 && debate.originalContribution > 0) {
        creatorInitialPaise += c.amount;
      } else {
        creatorSelfContinuationsPaise += c.amount;
      }
    } else {
      eligibleExternalBackingPaise += c.amount;
      externalContributionsCount++;
    }
  }

  const totalVerifiedBackingPaise = creatorInitialPaise + creatorSelfContinuationsPaise + eligibleExternalBackingPaise;
  const creatorRewardPaise = calculateCreatorReward(eligibleExternalBackingPaise, rateBps);
  const platformFeePaise = eligibleExternalBackingPaise - creatorRewardPaise;

  const formattedTotalBacking = formatINR(totalVerifiedBackingPaise);
  const formattedCreatorReward = formatINR(creatorRewardPaise);

  return {
    debateId: debate.id,
    title: debate.title,
    creatorUsername: debate.authorUsername,
    isAnonymous: debate.isAnonymous,
    status: debate.status,
    totalVerifiedBackingPaise,
    formattedTotalBacking,
    creatorInitialPaise,
    formattedCreatorInitial: formatINR(creatorInitialPaise),
    creatorSelfContinuationsPaise,
    formattedCreatorSelfContinuations: formatINR(creatorSelfContinuationsPaise),
    eligibleExternalBackingPaise,
    formattedEligibleExternalBacking: formatINR(eligibleExternalBackingPaise),
    creatorRewardPaise,
    formattedCreatorReward,
    platformFeePaise,
    formattedPlatformFee: formatINR(platformFeePaise),
    contributionCount: debate.contributions.length,
    externalContributionsCount,
    publicDisplayLabel: `${formattedTotalBacking} backed · Creator earns ${formattedCreatorReward}`,
  };
}

/**
 * Calculate user creator earnings across all their debates deterministically from authoritative ledger and contribution records.
 */
export async function calculateCreatorEconomics(
  username: string,
  rateBps: number = CREATOR_SHARE_BPS
): Promise<CreatorEconomicsBreakdown> {
  const cleanUsername = username.toLowerCase().trim();

  // 1. Fetch user record if exists
  const user = await prisma.user.findUnique({
    where: { username: cleanUsername },
    select: { id: true, username: true },
  });

  // 2. Fetch all debates created by this user
  const userDebates = await prisma.debate.findMany({
    where: {
      authorUsername: cleanUsername,
      status: { in: ['active', 'hidden'] },
    },
    include: {
      contributions: {
        where: { status: 'verified' },
      },
    },
  });

  let totalBackingPaise = 0;
  let creatorOwnStakePaise = 0;
  let eligibleExternalBackingPaise = 0;
  let totalVerifiedContributionsCount = 0;

  for (const debate of userDebates) {
    for (const c of debate.contributions) {
      totalVerifiedContributionsCount++;
      totalBackingPaise += c.amount;
      const isCreator = (c.authorUsername || '').toLowerCase().trim() === cleanUsername;
      if (isCreator) {
        creatorOwnStakePaise += c.amount;
      } else {
        eligibleExternalBackingPaise += c.amount;
      }
    }
  }

  // 3. Fetch immutable ledger entries for this creator
  const ledgerEntries = await prisma.creatorEarningsLedger.findMany({
    where: {
      creatorUsername: cleanUsername,
    },
    select: {
      grossAmountPaise: true,
      creatorRewardPaise: true,
      status: true,
    },
  });

  let ledgerPendingPaise = 0;
  let ledgerAvailablePaise = 0;
  let ledgerPaidPaise = 0;
  let hasLedgerRecords = ledgerEntries.length > 0;

  for (const entry of ledgerEntries) {
    if (entry.status === 'pending') {
      ledgerPendingPaise += entry.creatorRewardPaise;
    } else if (entry.status === 'available') {
      ledgerAvailablePaise += entry.creatorRewardPaise;
    } else if (entry.status === 'paid') {
      ledgerPaidPaise += entry.creatorRewardPaise;
    }
    // 'reversed' status is strictly ignored and excluded from balance
  }

  // 4. Deterministic earnings calculation
  // If ledger entries exist, use exact ledger sum; otherwise compute from verified external contributions
  const calculatedRewardFromContribs = calculateCreatorReward(eligibleExternalBackingPaise, rateBps);
  const creatorEarningsPaise = hasLedgerRecords 
    ? (ledgerPendingPaise + ledgerAvailablePaise + ledgerPaidPaise)
    : calculatedRewardFromContribs;

  const pendingEarningsPaise = hasLedgerRecords
    ? ledgerPendingPaise
    : Math.min(creatorEarningsPaise, Math.floor(creatorEarningsPaise * 0.10));

  const availableEarningsPaise = hasLedgerRecords
    ? ledgerAvailablePaise
    : (creatorEarningsPaise - pendingEarningsPaise);

  const paidEarningsPaise = hasLedgerRecords ? ledgerPaidPaise : 0;
  const platformFeePaise = Math.max(0, eligibleExternalBackingPaise - creatorEarningsPaise);

  return {
    userId: user?.id || null,
    username: cleanUsername,
    debatesCount: userDebates.length,
    totalVerifiedContributionsCount,
    totalBackingPaise,
    totalBackingRupees: totalBackingPaise / 100,
    formattedTotalBacking: formatINR(totalBackingPaise),
    creatorOwnStakePaise,
    creatorOwnStakeRupees: creatorOwnStakePaise / 100,
    formattedCreatorOwnStake: formatINR(creatorOwnStakePaise),
    eligibleExternalBackingPaise,
    eligibleExternalBackingRupees: eligibleExternalBackingPaise / 100,
    formattedEligibleExternalBacking: formatINR(eligibleExternalBackingPaise),
    creatorEarningsPaise,
    creatorEarningsRupees: creatorEarningsPaise / 100,
    formattedCreatorEarnings: formatINR(creatorEarningsPaise),
    pendingEarningsPaise,
    pendingEarningsRupees: pendingEarningsPaise / 100,
    formattedPendingEarnings: formatINR(pendingEarningsPaise),
    availableEarningsPaise,
    availableEarningsRupees: availableEarningsPaise / 100,
    formattedAvailableEarnings: formatINR(availableEarningsPaise),
    paidEarningsPaise,
    paidEarningsRupees: paidEarningsPaise / 100,
    formattedPaidEarnings: formatINR(paidEarningsPaise),
    platformFeePaise,
    platformFeeRupees: platformFeePaise / 100,
    formattedPlatformFee: formatINR(platformFeePaise),
  };
}

/**
 * Handle refund / reversal of a contribution:
 * Invalidates the corresponding CreatorEarningsLedger entry and prevents the creator from retaining invalidated rewards.
 */
export async function reverseCreatorReward(
  contributionId: string,
  reason: string = 'Payment refunded or chargeback'
): Promise<{ success: boolean; reversedAmountPaise: number }> {
  try {
    const ledgerEntry = await prisma.creatorEarningsLedger.findUnique({
      where: { contributionId },
    });

    if (!ledgerEntry || ledgerEntry.status === 'reversed') {
      return { success: false, reversedAmountPaise: 0 };
    }

    await prisma.creatorEarningsLedger.update({
      where: { contributionId },
      data: {
        status: 'reversed',
        reversedAt: new Date(),
        reversalReason: reason,
      },
    });

    return { success: true, reversedAmountPaise: ledgerEntry.creatorRewardPaise };
  } catch (error) {
    console.error('Error reversing creator reward:', error);
    return { success: false, reversedAmountPaise: 0 };
  }
}
