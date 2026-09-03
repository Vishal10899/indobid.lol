/**
 * INDOBID — DEBATE SERVICE
 */

import { debateRepository } from '../../infrastructure/database/repositories/debate.repository';
import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { categoryRepository } from '../../infrastructure/database/repositories/category.repository';
import { calculateRankingScore } from '../feed/ranking/ranking.service';
import { AuthorizationError, NotFoundError } from '../../lib/errors';
import { CreateDebateDTO, UpdateDebateDTO } from './debate.types';

export class DebateService {
  async getById(id: string) {
    const debate = await debateRepository.findByIdWithDetails(id);
    if (!debate) {
      throw new NotFoundError('Debate not found');
    }
    return debate;
  }

  async create(dto: CreateDebateDTO) {
    const [author, category] = await Promise.all([
      userRepository.findById(dto.authorId),
      categoryRepository.findById(dto.categoryId),
    ]);

    if (!author) throw new NotFoundError('Author not found');
    if (!category) throw new NotFoundError('Category not found');

    const isPaid = (dto.amountPaise || 0) > 0;
    const initialStatus = isPaid ? 'pending_payment' : 'active';

    const now = new Date();
    const initialRanking = calculateRankingScore({
      likeCount: 0,
      bookmarkCount: 0,
      impressionCount: 0,
      contributionCount: 0,
      uniqueParticipants: 1,
      totalVerifiedPaise: dto.amountPaise || 0,
      createdAt: now,
      contentLength: dto.content.length,
      hasHashtags: dto.content.includes('#'),
      reportCount: 0,
    });

    return debateRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      status: initialStatus,
      author: { connect: { id: author.id } },
      category: { connect: { id: category.id } },
      authorUsername: author.username || 'anonymous',
      authorDisplayName: author.displayName || author.username || 'Debater',
      totalVerifiedContribution: dto.amountPaise || 0,
      contributionCount: 0,
      trendingScore: initialRanking.finalScore,
    });
  }

  async update(id: string, userId: string, dto: UpdateDebateDTO) {
    const debate = await debateRepository.findById(id);
    if (!debate) throw new NotFoundError('Debate not found');

    if (debate.authorId !== userId) {
      throw new AuthorizationError('You are not authorized to edit this post');
    }

    const data: any = {};
    if (dto.title) data.title = dto.title.trim();
    if (dto.content) data.content = dto.content.trim();

    return debateRepository.update(id, data);
  }

  async hide(id: string, userId: string, isAdmin = false) {
    const debate = await debateRepository.findById(id);
    if (!debate) throw new NotFoundError('Debate not found');

    if (debate.authorId !== userId && !isAdmin) {
      throw new AuthorizationError('You are not authorized to hide this post');
    }

    return debateRepository.update(id, { status: 'hidden' });
  }
}

export const debateService = new DebateService();
