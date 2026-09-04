/**
 * INDOBID — CANONICAL AUTHOR IDENTITY RESOLVER
 * Authoritative single source of truth for resolving author identity across feeds,
 * post details, comments, activity, notifications, and search results.
 *
 * Invariants:
 * 1. Resolves dynamic displayName, username, and avatar from the joined User record.
 * 2. When a user updates their profile, all existing posts immediately reflect the latest canonical identity.
 * 3. In Ghost Mode / anonymous mode, never leaks real user ID, real username, email, or real avatar.
 * 4. Ghost posts render a stable ghost identity (e.g. "Silent Echo") with isClickableProfile = false.
 */

export interface AuthorIdentityInput {
  authorId?: string | null;
  authorUsername?: string | null;
  authorDisplayName?: string | null;
  author?: {
    id?: string;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    isVerified?: boolean | null;
    role?: string | null;
    isPrivate?: boolean | null;
    ghostMode?: boolean | null;
    ghostDisplayName?: string | null;
  } | null;
  isAnonymous?: boolean | null;
  isGhost?: boolean | null;
}

export interface ResolvedAuthorIdentity {
  authorId: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorIsVerified: boolean;
  authorRole: string | null;
  isAnonymous: boolean;
  isGhost: boolean;
  isClickableProfile: boolean;
}

export function resolveAuthorIdentity(
  item: AuthorIdentityInput,
  options?: { currentUserId?: string | null }
): ResolvedAuthorIdentity {
  const isGhost = Boolean(item.isGhost || item.author?.ghostMode);
  const isAnonymous = Boolean(item.isAnonymous || isGhost);
  const isOwner = Boolean(
    options?.currentUserId &&
    item.authorId &&
    options.currentUserId === item.authorId
  );

  if (isGhost) {
    const ghostName =
      item.author?.ghostDisplayName ||
      (item.authorDisplayName && item.authorDisplayName !== 'Debater' && item.authorDisplayName !== 'Anonymous'
        ? item.authorDisplayName
        : 'Silent Echo');

    const ghostUsername = item.authorUsername === 'anonymous' ? 'anonymous' : 'ghost_anonymous';

    return {
      authorId: isOwner ? (item.authorId || null) : null, // Never leak user ID to other clients
      authorUsername: isOwner ? (item.author?.username || ghostUsername) : ghostUsername,
      authorDisplayName: ghostName,
      authorAvatarUrl: null,
      authorIsVerified: false,
      authorRole: null,
      isAnonymous: true,
      isGhost: true,
      isClickableProfile: false,
    };
  }

  if (isAnonymous) {
    return {
      authorId: isOwner ? (item.authorId || null) : null,
      authorUsername: isOwner ? (item.author?.username || 'anonymous') : 'anonymous',
      authorDisplayName: 'Anonymous',
      authorAvatarUrl: null,
      authorIsVerified: false,
      authorRole: null,
      isAnonymous: true,
      isGhost: false,
      isClickableProfile: false,
    };
  }

  // Canonical normal public author identity:
  // Prefer User record displayName over denormalized debate field
  const canonicalDisplayName =
    item.author?.displayName?.trim() ||
    item.authorDisplayName?.trim() ||
    item.author?.username?.trim() ||
    item.authorUsername?.trim() ||
    'Debater';

  const canonicalUsername =
    item.author?.username?.trim() ||
    item.authorUsername?.trim() ||
    'user';

  const canonicalAvatar = item.author?.avatarUrl || null;
  const isVerified = Boolean(item.author?.isVerified);
  const role = item.author?.role || null;

  return {
    authorId: item.authorId || item.author?.id || null,
    authorUsername: canonicalUsername,
    authorDisplayName: canonicalDisplayName,
    authorAvatarUrl: canonicalAvatar,
    authorIsVerified: isVerified,
    authorRole: role,
    isAnonymous: false,
    isGhost: false,
    isClickableProfile: true,
  };
}
