/**
 * INDOBID — DEBATE VALIDATION
 */

import { z } from 'zod';
import { appConfig } from '../../config/app';

export const CreateDebateSchema = z.object({
  title: z
    .string()
    .min(appConfig.debateConstraints.MIN_TITLE_LENGTH, `Title must be at least ${appConfig.debateConstraints.MIN_TITLE_LENGTH} characters`)
    .max(appConfig.debateConstraints.MAX_TITLE_LENGTH, `Title must not exceed ${appConfig.debateConstraints.MAX_TITLE_LENGTH} characters`),
  content: z
    .string()
    .min(appConfig.debateConstraints.MIN_CONTENT_LENGTH, `Content must be at least ${appConfig.debateConstraints.MIN_CONTENT_LENGTH} characters`)
    .max(appConfig.debateConstraints.MAX_CONTENT_LENGTH, `Content must not exceed ${appConfig.debateConstraints.MAX_CONTENT_LENGTH} characters`),
  categoryId: z.string().min(1, 'Category is required'),
  amountPaise: z.number().int().nonnegative().optional().default(0),
});

export const UpdateDebateSchema = z.object({
  title: z
    .string()
    .min(appConfig.debateConstraints.MIN_TITLE_LENGTH)
    .max(appConfig.debateConstraints.MAX_TITLE_LENGTH)
    .optional(),
  content: z
    .string()
    .min(appConfig.debateConstraints.MIN_CONTENT_LENGTH)
    .max(appConfig.debateConstraints.MAX_CONTENT_LENGTH)
    .optional(),
});

export const ContinueDebateSchema = z.object({
  content: z
    .string()
    .min(appConfig.debateConstraints.MIN_ARGUMENT_LENGTH, 'Argument content is required')
    .max(appConfig.debateConstraints.MAX_ARGUMENT_LENGTH, 'Argument content is too long'),
  amountPaise: z.number().int().min(appConfig.money.MINIMUM_DEBATE_PAISE, 'Minimum continuation is $2.00'),
});
