/**
 * INDOBID — DEBATE AUTHORIZATION POLICIES
 * Enforces business permissions on debates and contributions.
 */

import { isFounder } from '../auth/authorization';
import { UserSession } from '../auth/session.service';

export interface DebateAuthorEntity {
  authorId?: string | null;
  authorUsername?: string;
  isAnonymous?: boolean;
}

export class DebatePolicy {
  canEdit(user: UserSession | null, debate: DebateAuthorEntity): boolean {
    if (!user) return false;
    if (!debate.authorId) return false;
    return debate.authorId === user.userId;
  }

  canHide(user: UserSession | null, debate: DebateAuthorEntity, isAdmin = false): boolean {
    if (isAdmin) return true;
    if (!user) return false;
    if (isFounder(user)) return true;
    return Boolean(debate.authorId && debate.authorId === user.userId);
  }

  canDelete(user: UserSession | null, debate: DebateAuthorEntity, isAdmin = false): boolean {
    return this.canHide(user, debate, isAdmin);
  }

  canPublishFree(user: UserSession | null): boolean {
    return true; // All registered and guest users can publish free opinions
  }
}

export const debatePolicy = new DebatePolicy();
