/**
 * INDOBID — NOTIFICATION REPOSITORY
 */

import { Prisma, Notification } from '@prisma/client';
import { prisma } from '../prisma';
import { safeDb } from '../transactions';

export class NotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    return safeDb(() => prisma.notification.findUnique({ where: { id } }));
  }

  async create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return safeDb(() => prisma.notification.create({ data }));
  }

  async findByUserId(userId: string, skip = 0, take = 30): Promise<Notification[]> {
    return safeDb(() =>
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      })
    );
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    return safeDb(() =>
      prisma.notification.update({
        where: { id },
        data: { isRead: true },
      })
    );
  }

  async markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
    return safeDb(() =>
      prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      })
    );
  }

  async countUnread(userId: string): Promise<number> {
    return safeDb(() =>
      prisma.notification.count({
        where: { userId, isRead: false },
      })
    );
  }
}

export const notificationRepository = new NotificationRepository();
