/**
 * INDOBID — FOLLOW REPOSITORY
 */

import { Follow } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class FollowRepository {
  async findUnique(followerId: string, followingId: string): Promise<Follow | null> {
    return safeDb(() =>
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
      })
    );
  }

  async create(followerId: string, followingId: string): Promise<Follow> {
    return safeDb(() =>
      prisma.follow.create({
        data: { followerId, followingId },
      })
    );
  }

  async delete(followerId: string, followingId: string): Promise<Follow> {
    return safeDb(() =>
      prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      })
    );
  }

  async findFollowingUserIds(followerId: string): Promise<string[]> {
    const follows = await safeDb(() =>
      prisma.follow.findMany({
        where: { followerId },
        select: { followingId: true },
      })
    );
    return follows.map((f) => f.followingId);
  }

  async countFollowers(userId: string): Promise<number> {
    return safeDb(() => prisma.follow.count({ where: { followingId: userId } }));
  }

  async countFollowing(userId: string): Promise<number> {
    return safeDb(() => prisma.follow.count({ where: { followerId: userId } }));
  }
}

export const followRepository = new FollowRepository();
