/**
 * INDOBID — BOOKMARK REPOSITORY
 */

import { DebateBookmark } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class BookmarkRepository {
  async findUnique(debateId: string, userId: string): Promise<DebateBookmark | null> {
    return safeDb(() =>
      prisma.debateBookmark.findUnique({
        where: { debateId_userId: { debateId, userId } },
      })
    );
  }

  async create(debateId: string, userId: string): Promise<DebateBookmark> {
    return safeDb(() =>
      prisma.debateBookmark.create({
        data: { debateId, userId },
      })
    );
  }

  async delete(debateId: string, userId: string): Promise<DebateBookmark> {
    return safeDb(() =>
      prisma.debateBookmark.delete({
        where: { debateId_userId: { debateId, userId } },
      })
    );
  }

  async findUserBookmarkedDebateIds(userId: string, limit = 30): Promise<string[]> {
    const bookmarks = await safeDb(() =>
      prisma.debateBookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { debateId: true },
      })
    );
    return bookmarks.map((b) => b.debateId);
  }

  async findUserBookmarks(userId: string, skip = 0, take = 20) {
    return safeDb(() =>
      prisma.debateBookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          debate: {
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isVerified: true,
                },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      })
    );
  }
}

export const bookmarkRepository = new BookmarkRepository();
