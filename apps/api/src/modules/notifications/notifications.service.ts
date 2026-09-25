import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  notificationQuerySchema,
  type EventEnvelope,
  type Notification,
  type UnreadCount,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import {
  NOTIFICATION_PROJECTOR,
  NOTIFICATIONS_REPOSITORY,
  type NotificationProjector,
  type NotificationRecord,
  type NotificationsRepository,
} from './notifications.types';
import { newNotificationId } from './prisma-notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: NotificationsRepository,
    @Inject(NOTIFICATION_PROJECTOR)
    private readonly projector: NotificationProjector,
  ) {}

  async list(
    userId: string,
    query: unknown,
  ): Promise<{ items: Notification[]; total: number; page: number; limit: number }> {
    const data = this.parse(notificationQuerySchema, query);
    const result = await this.repository.list(userId, data.page, data.limit);
    return {
      items: result.items.map((item) => this.toResponse(item)),
      total: result.total,
      page: data.page,
      limit: data.limit,
    };
  }

  async unreadCount(userId: string): Promise<UnreadCount> {
    return { unreadCount: await this.repository.unreadCount(userId) };
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.repository.markRead(id, userId);
    if (!notification) throw new ApiException(404, 'NOT_FOUND', 'The notification was not found.');
    return this.toResponse(notification);
  }

  async markAllRead(userId: string): Promise<UnreadCount> {
    await this.repository.markAllRead(userId);
    return { unreadCount: 0 };
  }

  /**
   * Projects a domain event into stored notifications. Called from the shared
   * outbox writer so notifications stay in step with the real event stream.
   */
  async project(event: EventEnvelope<Record<string, unknown>>, client?: unknown): Promise<number> {
    const drafts = this.projector.project(event);
    if (drafts.length === 0) return 0;
    await this.repository.createMany(
      drafts.map((draft) => ({
        id: newNotificationId(),
        userId: draft.userId,
        type: draft.type,
        title: draft.title,
        message: draft.message,
        // One notification per User per source event keeps replay safe.
        sourceEventId: event.eventId,
      })),
      client,
    );
    return drafts.length;
  }

  private toResponse(record: NotificationRecord): Notification {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      title: record.title,
      message: record.message,
      readAt: record.readAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success || result.data === undefined) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    }
    return result.data;
  }
}
