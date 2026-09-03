/**
 * INDOBID — BOOKMARK SERVICE
 */

import { bookmarkRepository } from '../../../infrastructure/database/repositories/bookmark.repository';
import { debateRepository } from '../../../infrastructure/database/repositories/debate.repository';
import { NotFoundError } from '../../../lib/errors';

export class BookmarkService {
  async toggleBookmark(debateId: string, userId: string): Promise<{ bookmarked: boolean }> {
    const debate = await debateRepository.findById(debateId);
    if (!debate) throw new NotFoundError('Debate not found');

    const existing = await bookmarkRepository.findUnique(debateId, userId);

    if (existing) {
      await bookmarkRepository.delete(debateId, userId);
      return { bookmarked: false };
    }

    await bookmarkRepository.create(debateId, userId);
    return { bookmarked: true };
  }

  async isBookmarked(debateId: string, userId: string): Promise<boolean> {
    const existing = await bookmarkRepository.findUnique(debateId, userId);
    return Boolean(existing);
  }

  async getUserBookmarks(userId: string, skip = 0, take = 20) {
    return bookmarkRepository.findUserBookmarks(userId, skip, take);
  }
}

export const bookmarkService = new BookmarkService();
