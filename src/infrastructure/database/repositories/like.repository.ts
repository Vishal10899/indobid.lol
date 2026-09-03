/**
 * INDOBID — LIKE REPOSITORY
 */

import { DebateLike } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class LikeRepository {
  async findUnique(debateId: string, userId: string): Promise<DebateLike | null> {
    return safeDb(() =>
      prisma.debateLike.findUnique({
        where: { debateId_userId: { debateId, userId } },
      })
    );
  }

  async create(debateId: string, userId: string): Promise<DebateLike> {
    return safeDb(() =>
      prisma.debateLike.create({
        data: { debateId, userId },
      })
    );
  }

  async delete(debateId: string, userId: string): Promise<DebateLike> {
    return safeDb(() =>
      prisma.debateLike.delete({
        where: { debateId_userId: { debateId, userId } },
      })
    );
  }

  async findUserLikedDebateIds(userId: string, limit = 30): Promise<string[]> {
    const likes = await safeDb(() =>
      prisma.debateLike.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { debateId: true },
      })
    );
    return likes.map((l) => l.debateId);
  }

  async countByDebateId(debateId: string): Promise<number> {
    return safeDb(() => prisma.debateLike.count({ where: { debateId } }));
  }
}

export const likeRepository = new LikeRepository();
