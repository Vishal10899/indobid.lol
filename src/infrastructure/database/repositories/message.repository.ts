/**
 * INDOBID — MESSAGE REPOSITORY
 */

import { Prisma, DirectMessage, Conversation } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class MessageRepository {
  async findConversation(participant1Id: string, participant2Id: string): Promise<Conversation | null> {
    const [p1, p2] = [participant1Id, participant2Id].sort();
    return safeDb(() =>
      prisma.conversation.findUnique({
        where: {
          participant1Id_participant2Id: {
            participant1Id: p1,
            participant2Id: p2,
          },
        },
      })
    );
  }

  async getOrCreateConversation(participant1Id: string, participant2Id: string): Promise<Conversation> {
    const [p1, p2] = [participant1Id, participant2Id].sort();
    return safeDb(() =>
      prisma.conversation.upsert({
        where: {
          participant1Id_participant2Id: {
            participant1Id: p1,
            participant2Id: p2,
          },
        },
        create: {
          participant1Id: p1,
          participant2Id: p2,
          lastMessageAt: new Date(),
        },
        update: {
          lastMessageAt: new Date(),
        },
      })
    );
  }

  async createMessage(data: Prisma.DirectMessageCreateInput): Promise<DirectMessage> {
    return safeDb(() => prisma.directMessage.create({ data }));
  }

  async findConversationMessages(conversationId: string, skip = 0, take = 50): Promise<DirectMessage[]> {
    return safeDb(() =>
      prisma.directMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      })
    );
  }

  async findUserConversations(userId: string) {
    return safeDb(() =>
      prisma.conversation.findMany({
        where: {
          OR: [{ participant1Id: userId }, { participant2Id: userId }],
        },
        orderBy: { lastMessageAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
    );
  }
}

export const messageRepository = new MessageRepository();
