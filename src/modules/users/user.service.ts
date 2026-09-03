/**
 * INDOBID — USER SERVICE
 */

import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { debateRepository } from '../../infrastructure/database/repositories/debate.repository';
import { followRepository } from '../../infrastructure/database/repositories/follow.repository';
import { ledgerRepository } from '../../infrastructure/database/repositories/ledger.repository';
import { NotFoundError } from '../../lib/errors';
import { UpdateProfileDTO, UserProfileDTO } from './user.types';

export class UserService {
  async getProfile(username: string): Promise<UserProfileDTO> {
    const normalized = username.toLowerCase().trim();
    const user = await userRepository.findByUsername(normalized);

    if (!user || !user.username) {
      throw new NotFoundError(`User @${username} not found`);
    }

    const [debatesCount, followersCount, followingCount, ledgerStats] = await Promise.all([
      debateRepository.count({ authorId: user.id, status: 'active' }),
      followRepository.countFollowers(user.id),
      followRepository.countFollowing(user.id),
      ledgerRepository.aggregateEarnings(user.username),
    ]);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      stats: {
        debatesCount,
        followersCount,
        followingCount,
        totalEarnedPaise: ledgerStats.totalEarnedPaise,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDTO) {
    const data: { displayName?: string; bio?: string } = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName.trim();
    if (dto.bio !== undefined) data.bio = dto.bio.trim();

    return userRepository.update(userId, data);
  }
}

export const userService = new UserService();
