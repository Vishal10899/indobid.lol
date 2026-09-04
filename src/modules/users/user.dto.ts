/**
 * INDOBID — USER DATA TRANSFER OBJECTS & SERIALIZATION
 * Guarantees zero leakage of emails, phone numbers, password hashes, or session tokens in public APIs.
 */

import { User } from '@prisma/client';

export interface PublicUserDTO {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  role: string;
  rank: number;
  countryCode: string | null;
  isPrivate: boolean;
  createdAt: Date;
}

export interface GhostUserDTO {
  displayName: string;
  isGhost: true;
  isAnonymous: true;
  isClickableProfile: false;
}

export interface AuthenticatedUserDTO extends PublicUserDTO {
  email: string | null;
  currencyCode: string | null;
  ghostMode: boolean;
  ghostDisplayName: string | null;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  totalContributedPaise?: number;
}

export interface NotificationActorDTO {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isGhost: boolean;
}

export interface MessageParticipantDTO {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

/**
 * Serializes a User database record into a safe PublicUserDTO.
 * Never includes email, phone, passwordHash, or private settings.
 */
export function toPublicUserDTO(user: Partial<User>): PublicUserDTO {
  return {
    id: user.id || '',
    username: user.username || 'user',
    displayName: user.displayName || user.username || 'Debater',
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || null,
    isVerified: Boolean(user.isVerified),
    role: user.role || 'user',
    rank: user.rank || 0,
    countryCode: user.countryCode || 'IN',
    isPrivate: Boolean(user.isPrivate),
    createdAt: user.createdAt || new Date(),
  };
}

/**
 * Serializes a User into an AuthenticatedUserDTO for the verified session owner.
 */
export function toAuthenticatedUserDTO(
  user: Partial<User> & {
    unreadNotificationsCount?: number;
    unreadMessagesCount?: number;
    totalContributedPaise?: number;
  }
): AuthenticatedUserDTO {
  return {
    ...toPublicUserDTO(user),
    email: user.email || null,
    currencyCode: user.currencyCode || 'INR',
    ghostMode: Boolean(user.ghostMode),
    ghostDisplayName: user.ghostDisplayName || null,
    unreadNotificationsCount: user.unreadNotificationsCount || 0,
    unreadMessagesCount: user.unreadMessagesCount || 0,
    totalContributedPaise: user.totalContributedPaise || 0,
  };
}
