import type { EventEnvelope, NotificationType } from '@campus-skill-exchange/contracts';

export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResult {
  items: NotificationRecord[];
  total: number;
}

export interface NotificationsRepository {
  createMany(
    rows: {
      id: string;
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      sourceEventId: string;
    }[],
    client?: unknown,
  ): Promise<void>;
  list(userId: string, page: number, limit: number): Promise<NotificationListResult>;
  unreadCount(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<NotificationRecord | null>;
  markAllRead(userId: string): Promise<number>;
}

export interface NotificationDraft {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export const NOTIFICATION_PROJECTOR = Symbol('NOTIFICATION_PROJECTOR');

export interface NotificationProjector {
  /**
   * Projects a committed domain event into notifications. Returning an empty
   * list simply means the event carries no in-app notification for a User.
   * Implementations must never fabricate recipients or notifications.
   */
  project(event: EventEnvelope<Record<string, unknown>>): NotificationDraft[];
}
