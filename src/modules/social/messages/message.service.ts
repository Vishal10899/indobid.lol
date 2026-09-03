/**
 * INDOBID — MESSAGE SERVICE
 * Handles private user direct messaging and conversation thread isolation.
 */

import { messageRepository } from '../../../infrastructure/database/repositories/message.repository';
import { userRepository } from '../../../infrastructure/database/repositories/user.repository';
import { notificationRepository } from '../../../infrastructure/database/repositories/notification.repository';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../lib/errors';
import { prisma } from '../../../infrastructure/database/prisma';
import { safeDb } from '../../../infrastructure/database/transactions';

export class MessageService {
  async getUserConversations(userId: string) {
    const conversations = await messageRepository.findUserConversations(userId);

    const otherUserIds = Array.from(
      new Set(
        conversations.map((c) =>
          c.participant1Id === userId ? c.participant2Id : c.participant1Id
        )
      )
    );

    const users = await safeDb(() =>
      prisma.user.findMany({
        where: { id: { in: otherUserIds } },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
    );

    const userMap = new Map(users.map((u) => [u.id, u]));

    return conversations.map((c) => {
      const otherId = c.participant1Id === userId ? c.participant2Id : c.participant1Id;
      const otherUser = userMap.get(otherId);
      const lastMsg = c.messages[0] || null;

      return {
        id: c.id,
        otherUser: otherUser || { id: otherId, username: 'user', displayName: 'Debater' },
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt,
              senderId: lastMsg.senderId,
              isRead: lastMsg.isRead,
            }
          : null,
        lastMessageAt: c.lastMessageAt,
      };
    });
  }

  async sendMessage(senderId: string, recipientIdOrUsername: string, content: string) {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Message content cannot be empty');
    }
    if (content.length > 2000) {
      throw new ValidationError('Message cannot exceed 2000 characters');
    }

    let recipientId = recipientIdOrUsername;
    let recipient = await userRepository.findById(recipientId);
    if (!recipient) {
      recipient = await userRepository.findByUsername(recipientIdOrUsername);
      if (recipient) recipientId = recipient.id;
    }

    if (!recipient) {
      throw new NotFoundError('Recipient not found');
    }

    if (senderId === recipientId) {
      throw new ValidationError('You cannot send a message to yourself');
    }

    const conversation = await messageRepository.getOrCreateConversation(senderId, recipientId);

    const message = await messageRepository.createMessage({
      conversation: { connect: { id: conversation.id } },
      sender: { connect: { id: senderId } },
      recipient: { connect: { id: recipientId } },
      content: content.trim(),
    });

    // Notify recipient
    await notificationRepository.create({
      user: { connect: { id: recipientId } },
      type: 'message',
      title: 'New Message',
      message: content.trim().substring(0, 100),
      linkUrl: `/messages/${conversation.id}`,
    });

    return { conversationId: conversation.id, message };
  }

  async getConversationMessages(conversationId: string, userId: string) {
    const conversation = await safeDb(() =>
      prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 100,
          },
        },
      })
    );

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
      throw new AuthorizationError('You are not a participant in this conversation');
    }

    const otherId =
      conversation.participant1Id === userId
        ? conversation.participant2Id
        : conversation.participant1Id;

    const otherUser = await userRepository.findById(otherId);

    // Mark unread messages sent to this user as read
    await safeDb(() =>
      prisma.directMessage.updateMany({
        where: {
          conversationId,
          recipientId: userId,
          isRead: false,
        },
        data: { isRead: true },
      })
    );

    return {
      conversation,
      otherUser: otherUser
        ? {
            id: otherUser.id,
            username: otherUser.username,
            displayName: otherUser.displayName,
            avatarUrl: otherUser.avatarUrl,
          }
        : null,
      messages: conversation.messages,
    };
  }

  async sendThreadMessage(conversationId: string, senderId: string, senderUsername: string, content: string) {
    if (!content?.trim()) {
      throw new ValidationError('Message content is required');
    }

    const conversation = await safeDb(() =>
      prisma.conversation.findUnique({
        where: { id: conversationId },
      })
    );

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    if (conversation.participant1Id !== senderId && conversation.participant2Id !== senderId) {
      throw new AuthorizationError('Access denied');
    }

    const recipientId =
      conversation.participant1Id === senderId
        ? conversation.participant2Id
        : conversation.participant1Id;

    const message = await safeDb(() =>
      prisma.directMessage.create({
        data: {
          conversationId,
          senderId,
          recipientId,
          content: content.trim(),
        },
      })
    );

    await safeDb(() =>
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      })
    );

    // Notification to recipient
    await safeDb(() =>
      prisma.notification.create({
        data: {
          userId: recipientId,
          type: 'message',
          title: 'New Message',
          message: `@${senderUsername}: "${content.trim().substring(0, 40)}..."`,
          linkUrl: `/messages/${conversationId}`,
        },
      })
    ).catch(() => {});

    return message;
  }
}

export const messageService = new MessageService();
