/**
 * INDOBID — USER VALIDATION
 */

import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name cannot be empty').max(50, 'Display name max 50 chars').optional(),
  bio: z.string().max(300, 'Bio max 300 chars').optional(),
});
