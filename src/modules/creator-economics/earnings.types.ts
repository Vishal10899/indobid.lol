/**
 * INDOBID — CREATOR ECONOMICS TYPES
 */

export interface CreatorEconomicsResult {
  grossAmountPaise: number;
  creatorRewardPaise: number;
  platformFeePaise: number;
  percentageBps: number;
  isEligibleForReward: boolean;
}

export interface CalculateCreatorEconomicsParams {
  amountPaise: number;
  isDebateAuthor: boolean;
  sequence: number;
}

export interface CreatorEconomicsBreakdown {
  userId?: string | null;
  username: string;
  debatesCount: number;
  totalVerifiedContributionsCount: number;
  totalBackingPaise: number;
  totalBackingRupees: number;
  formattedTotalBacking: string;
  creatorOwnStakePaise: number;
  creatorOwnStakeRupees: number;
  formattedCreatorOwnStake: string;
  eligibleExternalBackingPaise: number;
  eligibleExternalBackingRupees: number;
  formattedEligibleExternalBacking: string;
  creatorEarningsPaise: number;
  creatorEarningsRupees: number;
  formattedCreatorEarnings: string;
  pendingEarningsPaise: number;
  pendingEarningsRupees: number;
  formattedPendingEarnings: string;
  availableEarningsPaise: number;
  availableEarningsRupees: number;
  formattedAvailableEarnings: string;
  paidEarningsPaise: number;
  paidEarningsRupees: number;
  formattedPaidEarnings: string;
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
  totalVerifiedBackingPaise: number;
  formattedTotalBacking: string;
  creatorInitialPaise: number;
  formattedCreatorInitial: string;
  creatorSelfContinuationsPaise: number;
  formattedCreatorSelfContinuations: string;
  eligibleExternalBackingPaise: number;
  formattedEligibleExternalBacking: string;
  creatorRewardPaise: number;
  formattedCreatorReward: string;
  platformFeePaise: number;
  formattedPlatformFee: string;
  contributionCount: number;
  externalContributionsCount: number;
  publicDisplayLabel: string;
}
