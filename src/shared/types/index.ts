/**
 * INDOBID — SHARED DOMAIN TYPES
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type UserRole = 'user' | 'admin' | 'founder';
export type DebateStatus = 'pending_payment' | 'active' | 'hidden' | 'removed';
export type ContributionStatus = 'pending' | 'verified' | 'rejected';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type LedgerStatus = 'pending' | 'eligible' | 'paid' | 'settled';
