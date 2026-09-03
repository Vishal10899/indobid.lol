/**
 * INDOBID — MODERATION TYPES
 */

export interface CreateReportDTO {
  debateId: string;
  reporterId?: string;
  reason: string;
  details?: string;
}

export interface ResolveReportDTO {
  reportId: string;
  action: 'dismiss' | 'hide_debate' | 'suspend_user';
  notes?: string;
}
