/**
 * INDOBID — USER MODULE TYPES
 */

export interface UserProfileDTO {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  isVerified: boolean;
  countryCode: string | null;
  currencyCode: string | null;
  isPrivate: boolean;
  isRestricted?: boolean;
  isFollowing?: boolean;
  ghostMode?: boolean;
  ghostDisplayName?: string | null;
  createdAt: Date;
  stats: {
    debatesCount: number;
    followersCount: number;
    followingCount: number;
    totalEarnedPaise: number;
  };
}

export interface UpdateProfileDTO {
  displayName?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  interests?: string;
  countryCode?: string;
  isPrivate?: boolean;
  ghostMode?: boolean;
}
