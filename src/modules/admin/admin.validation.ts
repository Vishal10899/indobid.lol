/**
 * INDOBID — ADMIN VALIDATION SCHEMAS
 */

import { z } from 'zod';

export const adminUserUpdateSchema = z.object({
  isSuspended: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  role: z.enum(['user', 'admin', 'founder']).optional(),
});

export const adminDebateUpdateSchema = z.object({
  status: z.enum(['active', 'hidden', 'pending_payment', 'removed']),
});
