/**
 * INDOBID — LIKE SERVICE
 */

import { likeRepository } from '../../../infrastructure/database/repositories/like.repository';
import { debateRepository } from '../../../infrastructure/database/repositories/debate.repository';
import { notificationRepository } from '../../../infrastructure/database/repositories/notification.repository';
import { NotFoundError } from '../../../lib/errors';

export class LikeService {
  async toggleLike(debateId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    const debate = await debateRepository.findById(debateId);
    if (!debate) throw new NotFoundError('Debate not found');

    const existing = await likeRepository.findUnique(debateId, userId);

    if (existing) {
      await likeRepository.delete(debateId, userId);
      const likesCount = await likeRepository.countByDebateId(debateId);
      return { liked: false, likesCount };
    }

    await likeRepository.create(debateId, userId);

    // Notify author if not self-like
    if (debate.authorId && debate.authorId !== userId) {
      await notificationRepository.create({
        user: { connect: { id: debate.authorId } },
        type: 'like',
        title: 'New Like',
        message: 'Someone liked your debate',
        linkUrl: `/debate/${debateId}`,
      });
    }

    const likesCount = await likeRepository.countByDebateId(debateId);
    return { liked: true, likesCount };
  }

  async isLiked(debateId: string, userId: string): Promise<boolean> {
    const existing = await likeRepository.findUnique(debateId, userId);
    return Boolean(existing);
  }
}

export const likeService = new LikeService();
