/**
 * INDOBID — ADMIN MODULE TYPES
 */

export interface AdminStatsMetrics {
  debates: {
    total: number;
    active: number;
    todayNew: number;
    pendingPayment: number;
    hidden: number;
    removed: number;
  };
  contributions: {
    total: number;
    verified: number;
    pending: number;
    failed: number;
    canceled: number;
  };
  financials: {
    currency: string;
    totalRevenuePaise: number;
    totalRevenueRupees: number;
    todayRevenueRupees: number;
    weekRevenueRupees: number;
    monthRevenueRupees: number;
    totalCreatorRewardsPaise: number;
    totalCreatorRewardsRupees: number;
  };
  payments: {
    total: number;
    successful: number;
    failed: number;
    canceled: number;
    pending: number;
  };
  users: {
    total: number;
    todayNew: number;
  };
  moderation: {
    pendingReports: number;
  };
  visitors: any;
  rankings: {
    topSupported: any[];
    mostActive: any[];
    topTrending: any[];
  };
}

export interface AdminUserUpdateDTO {
  isSuspended?: boolean;
  isVerified?: boolean;
  role?: string;
}

export interface AdminDebateUpdateDTO {
  status?: string;
}
