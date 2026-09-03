/**
 * INDOBID — COMMENT SERVICE (SEQUENTIAL DEBATE ARGUMENTS & REPLIES)
 */

import { contributionRepository } from '../../../infrastructure/database/repositories/contribution.repository';
import { debateRepository } from '../../../infrastructure/database/repositories/debate.repository';
import { NotFoundError } from '../../../lib/errors';

export class CommentService {
  async getContributions(debateId: string) {
    const debate = await debateRepository.findById(debateId);
    if (!debate) throw new NotFoundError('Debate not found');

    return contributionRepository.findByDebateId(debateId, 'verified');
  }
}

export const commentService = new CommentService();
