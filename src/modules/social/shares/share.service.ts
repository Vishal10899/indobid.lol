/**
 * INDOBID — SHARE SERVICE
 */

import { debateRepository } from '../../../infrastructure/database/repositories/debate.repository';
import { NotFoundError } from '../../../lib/errors';
import { env } from '../../../config/env';

export class ShareService {
  async getShareLink(debateId: string): Promise<{ url: string; title: string }> {
    const debate = await debateRepository.findById(debateId);
    if (!debate) throw new NotFoundError('Debate not found');

    return {
      url: `${env.NEXT_PUBLIC_APP_URL}/debate/${debate.id}`,
      title: debate.title,
    };
  }
}

export const shareService = new ShareService();
