/**
 * INDOBID — NOTIFICATION SERVICE
 */

import { notificationRepository } from '../../infrastructure/database/repositories/notification.repository';
import { CreateNotificationDTO } from './notification.types';

export class NotificationService {
  async create(dto: CreateNotificationDTO) {
    return notificationRepository.create({
      user: { connect: { id: dto.userId } },
      type: dto.type,
      title: dto.title,
      message: dto.body,
      linkUrl: dto.data?.debateId ? `/debate/${dto.data.debateId}` : null,
    });
  }

  async getUserNotifications(userId: string, skip = 0, take = 30) {
    return notificationRepository.findByUserId(userId, skip, take);
  }

  async markAsRead(id: string, userId: string) {
    return notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  }
}

export const notificationService = new NotificationService();
