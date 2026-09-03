/**
 * INDOBID — NOTIFICATION TYPES
 */

export interface CreateNotificationDTO {
  userId: string;
  actorId?: string;
  type: 'like' | 'follow' | 'reply' | 'support' | 'mention' | 'message' | 'report';
  title: string;
  body: string;
  data?: Record<string, any>;
}
