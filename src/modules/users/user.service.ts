/**
 * INDOBID — USER SERVICE
 * Authoritative user identity, profile management, username uniqueness,
 * 30-day username change limits, privacy enforcement, and Ghost Mode lifecycle.
 */

import { userRepository } from '../../infrastructure/database/repositories/user.repository';
import { debateRepository } from '../../infrastructure/database/repositories/debate.repository';
import { followRepository } from '../../infrastructure/database/repositories/follow.repository';
import { ledgerRepository } from '../../infrastructure/database/repositories/ledger.repository';
import { prisma } from '../../infrastructure/database/prisma';
import { safeDb, runTransaction } from '../../infrastructure/database/transactions';
import { NotFoundError, ValidationError, ConflictError } from '../../lib/errors';
import { UpdateProfileDTO, UserProfileDTO } from './user.types';
import { generateGhostDisplayName } from '../../lib/ghost/ghost-identity';
import { isValidCountryCode, getCurrencyForCountry } from '../../lib/money';

const USERNAME_REGEX = /^[a-z0-9_]{3,25}$/;
const MAX_USERNAME_CHANGES_30_DAYS = 3;

export class UserService {
  /**
   * Fetches user profile by username.
   * Respects private account restrictions and ghost mode isolation.
   */
  async getProfile(username: string, viewerUserId?: string | null): Promise<UserProfileDTO> {
    const normalized = username.toLowerCase().trim();
    const user = await userRepository.findByUsername(normalized);

    if (!user || !user.username) {
      throw new NotFoundError(`User @${username} not found`);
    }

    const isOwner = Boolean(viewerUserId && viewerUserId === user.id);
    let isFollowing = false;

    if (viewerUserId && !isOwner) {
      isFollowing = await followRepository.isFollowing(viewerUserId, user.id);
    }

    // If private account and viewer is neither the owner nor an approved follower:
    // Restrict profile data access
    const isRestrictedPrivate = user.isPrivate && !isOwner && !isFollowing;

    const [debatesCount, followersCount, followingCount, ledgerStats] = await Promise.all([
      // If public viewer, strictly count active public posts (not ghost/anonymous)
      isRestrictedPrivate
        ? 0
        : debateRepository.count({
            authorId: user.id,
            status: 'active',
            ...(isOwner ? {} : { isAnonymous: false, isGhost: false }),
          }),
      followRepository.countFollowers(user.id),
      followRepository.countFollowing(user.id),
      ledgerRepository.aggregateEarnings(user.username),
    ]);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
      bio: isRestrictedPrivate ? null : user.bio,
      role: user.role,
      isVerified: user.isVerified,
      countryCode: user.countryCode || 'IN',
      currencyCode: user.currencyCode || 'INR',
      isPrivate: user.isPrivate,
      isRestricted: isRestrictedPrivate,
      isFollowing: isFollowing,
      ghostMode: isOwner ? user.ghostMode : undefined,
      ghostDisplayName: isOwner ? user.ghostDisplayName : undefined,
      createdAt: user.createdAt,
      stats: {
        debatesCount: isRestrictedPrivate ? 0 : debatesCount,
        followersCount: isRestrictedPrivate ? 0 : followersCount,
        followingCount: isRestrictedPrivate ? 0 : followingCount,
        totalEarnedPaise: isOwner ? ledgerStats.totalEarnedPaise : 0,
      },
    };
  }

  /**
   * Updates user profile with server-side validation.
   * Enforces 3 username changes per 30 days and synchronizes denormalized UGC fields.
   */
  async updateProfile(userId: string, dto: UpdateProfileDTO) {
    const currentUser = await userRepository.findById(userId);
    if (!currentUser) {
      throw new NotFoundError('User not found');
    }

    const updateData: {
      displayName?: string;
      username?: string;
      bio?: string;
      avatarUrl?: string;
      interests?: string;
      countryCode?: string;
      currencyCode?: string;
      isPrivate?: boolean;
      ghostMode?: boolean;
      ghostDisplayName?: string;
    } = {};

    let usernameChanging = false;
    let cleanNewUsername: string | undefined;

    // 1. Username change handling
    if (dto.username !== undefined) {
      cleanNewUsername = dto.username.toLowerCase().trim();
      if (cleanNewUsername !== currentUser.username) {
        if (!USERNAME_REGEX.test(cleanNewUsername)) {
          throw new ValidationError(
            'Username must be 3-25 characters long and contain only lowercase letters, numbers, and underscores.'
          );
        }

        // Founder username protection
        const founderUsernames = ['vishalkumar', 'admin', 'indobid', 'vishalchaudhary'];
        if (
          founderUsernames.includes(cleanNewUsername) &&
          currentUser.role !== 'founder' &&
          currentUser.role !== 'admin'
        ) {
          throw new ValidationError('This username is reserved and cannot be claimed.');
        }

        // Enforce 3 username changes per rolling 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentChangeCount = await safeDb(() =>
          prisma.usernameChangeHistory.count({
            where: {
              userId,
              changedAt: { gte: thirtyDaysAgo },
            },
          })
        );

        if (recentChangeCount >= MAX_USERNAME_CHANGES_30_DAYS) {
          throw new ValidationError(
            `You can only change your username a maximum of ${MAX_USERNAME_CHANGES_30_DAYS} times within any 30-day period.`
          );
        }

        // Check if username is already taken by another user
        const existing = await safeDb(() =>
          prisma.user.findUnique({
            where: { username: cleanNewUsername },
          })
        );

        if (existing && existing.id !== userId) {
          throw new ConflictError('Username is already taken by another account.');
        }

        updateData.username = cleanNewUsername;
        usernameChanging = true;
      }
    }

    // 2. Display name handling
    if (dto.displayName !== undefined) {
      const cleanDisplayName = dto.displayName.trim();
      if (cleanDisplayName.length > 50) {
        throw new ValidationError('Display name cannot exceed 50 characters.');
      }
      updateData.displayName = cleanDisplayName.length > 0 ? cleanDisplayName : (cleanNewUsername || currentUser.username || 'Debater');
    }

    // 3. Bio handling
    if (dto.bio !== undefined) {
      updateData.bio = dto.bio.trim().substring(0, 300);
    }

    // 4. Avatar URL handling
    if (dto.avatarUrl !== undefined) {
      updateData.avatarUrl = dto.avatarUrl ? dto.avatarUrl.trim() : null as any;
    }

    // 5. Interests handling
    if (dto.interests !== undefined) {
      updateData.interests = dto.interests.trim().substring(0, 200);
    }

    // 6. Country & Currency handling
    if (dto.countryCode !== undefined) {
      const cleanCountry = dto.countryCode.trim().toUpperCase();
      if (isValidCountryCode(cleanCountry)) {
        updateData.countryCode = cleanCountry;
        updateData.currencyCode = getCurrencyForCountry(cleanCountry);
      } else {
        throw new ValidationError('Invalid country code.');
      }
    }

    // 7. Privacy settings handling
    if (dto.isPrivate !== undefined) {
      updateData.isPrivate = Boolean(dto.isPrivate);
    }

    // 8. Ghost Mode handling
    if (dto.ghostMode !== undefined) {
      updateData.ghostMode = Boolean(dto.ghostMode);
      if (updateData.ghostMode && !currentUser.ghostDisplayName) {
        updateData.ghostDisplayName = generateGhostDisplayName();
      }
    }

    // 9. Atomic Transaction: Update User + Record Username Change + Synchronize Denormalized UGC
    return runTransaction(async (tx) => {
      // If username changed, record in history
      if (usernameChanging && cleanNewUsername) {
        await tx.usernameChangeHistory.create({
          data: {
            userId,
            oldUsername: currentUser.username,
            newUsername: cleanNewUsername,
          },
        });
      }

      // Update canonical user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      // Synchronize denormalized fields across historical public posts and contributions
      if (updateData.displayName || updateData.username) {
        const syncData: any = {};
        if (updateData.displayName) {
          syncData.authorDisplayName = updateData.displayName;
        }
        if (updateData.username) {
          syncData.authorUsername = updateData.username;
        }

        // Only update public non-anonymous posts
        await tx.debate.updateMany({
          where: { authorId: userId, isAnonymous: false, isGhost: false },
          data: syncData,
        });

        await tx.contribution.updateMany({
          where: { authorId: userId, isAnonymous: false, isGhost: false },
          data: syncData,
        });

        if (currentUser.username && updateData.username) {
          await tx.debateActivityEvent.updateMany({
            where: { authorUsername: currentUser.username },
            data: {
              ...(updateData.displayName ? { authorDisplayName: updateData.displayName } : {}),
              authorUsername: updateData.username,
            },
          });
        }
      }

      return updatedUser;
    });
  }

  /**
   * Checks how many username changes a user has remaining in the current 30-day window.
   */
  async getUsernameChangeStatus(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentChanges = await safeDb(() =>
      prisma.usernameChangeHistory.findMany({
        where: { userId, changedAt: { gte: thirtyDaysAgo } },
        orderBy: { changedAt: 'desc' },
      })
    );

    const changesUsed = recentChanges.length;
    const remainingChanges = Math.max(0, MAX_USERNAME_CHANGES_30_DAYS - changesUsed);
    const nextAvailableDate =
      changesUsed >= MAX_USERNAME_CHANGES_30_DAYS
        ? new Date(recentChanges[recentChanges.length - 1].changedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
        : null;

    return {
      changesUsed,
      remainingChanges,
      maxChanges: MAX_USERNAME_CHANGES_30_DAYS,
      canChange: remainingChanges > 0,
      nextAvailableDate,
    };
  }
}

export const userService = new UserService();
