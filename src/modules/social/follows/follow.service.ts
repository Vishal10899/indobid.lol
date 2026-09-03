/**
 * INDOBID — FOLLOW SERVICE
 */

import { followRepository } from '../../../infrastructure/database/repositories/follow.repository';
import { userRepository } from '../../../infrastructure/database/repositories/user.repository';
import { notificationRepository } from '../../../infrastructure/database/repositories/notification.repository';
import { NotFoundError, ValidationError } from '../../../lib/errors';

export class FollowService {
  async toggleFollow(
    followerId: string,
    targetUsername: string
  ): Promise<{ following: boolean; followersCount: number }> {
    const targetUser = await userRepository.findByUsername(targetUsername);
    if (!targetUser) throw new NotFoundError('User not found');

    if (followerId === targetUser.id) {
      throw new ValidationError('You cannot follow yourself');
    }

    const existing = await followRepository.findUnique(followerId, targetUser.id);

    if (existing) {
      await followRepository.delete(followerId, targetUser.id);
      const followersCount = await followRepository.countFollowers(targetUser.id);
      return { following: false, followersCount };
    }

    await followRepository.create(followerId, targetUser.id);

    // Notify target user
    await notificationRepository.create({
      user: { connect: { id: targetUser.id } },
      type: 'follow',
      title: 'New Follower',
      message: 'Someone started following you',
    });

    const followersCount = await followRepository.countFollowers(targetUser.id);
    return { following: true, followersCount };
  }

  async isFollowing(followerId: string, targetUserId: string): Promise<boolean> {
    const existing = await followRepository.findUnique(followerId, targetUserId);
    return Boolean(existing);
  }
}

export const followService = new FollowService();
