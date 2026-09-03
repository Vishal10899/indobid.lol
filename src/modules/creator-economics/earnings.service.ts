/**
 * INDOBID — CREATOR ECONOMICS SERVICE
 * Enforces 50% Creator / 50% Platform revenue split & 0% author self-support rule.
 */

import { prisma } from '../../infrastructure/database/prisma';
import { formatINR } from '../../lib/money';
import {
  CalculateCreatorEconomicsParams,
  CreatorEconomicsBreakdown,
  CreatorEconomicsResult,
  DebateRewardBreakdown,
} from './earnings.types';

export const CREATOR_SHARE_BPS = 5000; // 50.00% (50/50 Revenue Split)
export const BPS_DENOMINATOR = 10000;
export const PLATFORM_FEE_BPS = 5000;

export function calculateCreatorReward(
  amountPaise: number,
  rateBps: number = CREATOR_SHARE_BPS
): number {
  if (typeof amountPaise !== 'number' || amountPaise <= 0 || isNaN(amountPaise)) {
    return 0;
  }
  return Math.floor((amountPaise * rateBps) / BPS_DENOMINATOR);
}

export class EarningsService {
  calculateCreatorEconomics(params: CalculateCreatorEconomicsParams): CreatorEconomicsResult {
    const { amountPaise, isDebateAuthor, sequence } = params;

    // Self-support rule: Author initial stake (sequence === 1) or self-continuations generate 0 creator rewards
    if (isDebateAuthor || sequence === 1) {
      return {
        grossAmountPaise: amountPaise,
        creatorRewardPaise: 0,
        platformFeePaise: amountPaise,
        percentageBps: 0,
        isEligibleForReward: false,
      };
    }

    // Community Supporter backing: 50% to Creator / 50% to Platform Protocol
    const creatorRewardPaise = Math.floor((amountPaise * CREATOR_SHARE_BPS) / BPS_DENOMINATOR);
    const platformFeePaise = amountPaise - creatorRewardPaise;

    return {
      grossAmountPaise: amountPaise,
      creatorRewardPaise,
      platformFeePaise,
      percentageBps: CREATOR_SHARE_BPS,
      isEligibleForReward: true,
    };
  }

  async calculateDebateReward(
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

    const totalVerifiedBackingPaise =
      creatorInitialPaise + creatorSelfContinuationsPaise + eligibleExternalBackingPaise;
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

  async calculateCreatorEconomicsBreakdown(
    username: string,
    rateBps: number = CREATOR_SHARE_BPS
  ): Promise<CreatorEconomicsBreakdown> {
    const cleanUsername = username.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
      select: { id: true, username: true },
    });

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

    const ledgerEntries = await prisma.creatorEarningsLedger.findMany({
      where: { creatorUsername: cleanUsername },
      select: {
        grossAmountPaise: true,
        creatorRewardPaise: true,
        status: true,
      },
    });

    let ledgerPendingPaise = 0;
    let ledgerAvailablePaise = 0;
    let ledgerPaidPaise = 0;
    const hasLedgerRecords = ledgerEntries.length > 0;

    for (const entry of ledgerEntries) {
      if (entry.status === 'pending') {
        ledgerPendingPaise += entry.creatorRewardPaise;
      } else if (entry.status === 'available') {
        ledgerAvailablePaise += entry.creatorRewardPaise;
      } else if (entry.status === 'paid') {
        ledgerPaidPaise += entry.creatorRewardPaise;
      }
    }

    const calculatedRewardFromContribs = calculateCreatorReward(
      eligibleExternalBackingPaise,
      rateBps
    );
    const creatorEarningsPaise = hasLedgerRecords
      ? ledgerPendingPaise + ledgerAvailablePaise + ledgerPaidPaise
      : calculatedRewardFromContribs;

    const pendingEarningsPaise = hasLedgerRecords
      ? ledgerPendingPaise
      : Math.min(creatorEarningsPaise, Math.floor(creatorEarningsPaise * 0.1));

    const availableEarningsPaise = hasLedgerRecords
      ? ledgerAvailablePaise
      : creatorEarningsPaise - pendingEarningsPaise;

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

  async reverseCreatorReward(
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
}

export const earningsService = new EarningsService();

export function calculateCreatorEconomics(
  username: string,
  rateBps?: number
): Promise<CreatorEconomicsBreakdown>;
export function calculateCreatorEconomics(
  params: CalculateCreatorEconomicsParams
): CreatorEconomicsResult;
export function calculateCreatorEconomics(
  usernameOrParams: string | CalculateCreatorEconomicsParams,
  rateBps?: number
): Promise<CreatorEconomicsBreakdown> | CreatorEconomicsResult {
  if (typeof usernameOrParams === 'string') {
    return earningsService.calculateCreatorEconomicsBreakdown(usernameOrParams, rateBps);
  }
  return earningsService.calculateCreatorEconomics(usernameOrParams);
}

export const calculateDebateReward = (debateId: string, rateBps?: number) =>
  earningsService.calculateDebateReward(debateId, rateBps);

export const reverseCreatorReward = (contributionId: string, reason?: string) =>
  earningsService.reverseCreatorReward(contributionId, reason);
