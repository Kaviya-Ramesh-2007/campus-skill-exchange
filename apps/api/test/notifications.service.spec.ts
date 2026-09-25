import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { DomainEventNotificationProjector } from '../src/modules/notifications/notification-projector';
import type { NotificationType } from '@campus-skill-exchange/contracts';
import type {
  NotificationRecord,
  NotificationsRepository,
} from '../src/modules/notifications/notifications.types';
import type { EventEnvelope } from '@campus-skill-exchange/contracts';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const now = new Date('2026-10-01T12:00:00.000Z');

class FakeNotificationsRepository implements NotificationsRepository {
  rows: NotificationRecord[] = [];
  created: unknown[] = [];

  async createMany(
    rows: {
      id: string;
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      sourceEventId: string;
    }[],
  ) {
    this.created.push(...rows);
  }
  async list(ownerId: string, page: number, limit: number) {
    const items = this.rows.filter((row) => row.userId === ownerId);
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length };
  }
  async unreadCount(ownerId: string) {
    return this.rows.filter((row) => row.userId === ownerId && !row.readAt).length;
  }
  async markRead(id: string, ownerId: string) {
    const row = this.rows.find((item) => item.id === id && item.userId === ownerId);
    if (row && !row.readAt) row.readAt = now;
    return row ?? null;
  }
  async markAllRead(ownerId: string) {
    let count = 0;
    for (const row of this.rows) {
      if (row.userId === ownerId && !row.readAt) {
        row.readAt = now;
        count += 1;
      }
    }
    return count;
  }
}

function setup() {
  const repository = new FakeNotificationsRepository();
  const service = new NotificationsService(repository, new DomainEventNotificationProjector());
  return { repository, service };
}

function event(): EventEnvelope<Record<string, unknown>> {
  return {
    eventId: '00000000-0000-4000-8000-000000000003',
    eventType: 'REQUEST_SENT',
    version: 1,
    occurredAt: now.toISOString(),
    actorId: userId,
    entityType: 'X',
    entityId: '00000000-0000-4000-8000-000000000004',
    correlationId: null,
    causationId: null,
    idempotencyKey: 'k',
    payload: { requesterUserId: userId, recipientUserId: otherUserId },
  } as unknown as EventEnvelope<Record<string, unknown>>;
}

describe('NotificationsService', () => {
  it('projects a domain event into stored notifications', async () => {
    const { service, repository } = setup();
    const count = await service.project(event());
    expect(count).toBe(1);
    expect(repository.created).toHaveLength(1);
    expect(repository.created[0]).toMatchObject({ userId: otherUserId, type: 'REQUEST_SENT' });
  });

  it('stores nothing for an event with no recipient', async () => {
    const { service, repository } = setup();
    const count = await service.project({ ...event(), payload: {} } as never);
    expect(count).toBe(0);
    expect(repository.created).toHaveLength(0);
  });

  it('lists only the current Users notifications, newest first', async () => {
    const { service, repository } = setup();
    repository.rows = [
      {
        id: 'a',
        userId: userId,
        type: 'REQUEST_SENT',
        title: 't',
        message: 'm',
        readAt: null,
        createdAt: now,
      },
      {
        id: 'b',
        userId: otherUserId,
        type: 'REQUEST_SENT',
        title: 't',
        message: 'm',
        readAt: null,
        createdAt: now,
      },
    ];
    const result = await service.list(userId, {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe('a');
    expect(result.items[0]!.createdAt).toBe(now.toISOString());
  });

  it('counts and clears only the current Users unread notifications', async () => {
    const { service, repository } = setup();
    repository.rows = [
      {
        id: 'a',
        userId: userId,
        type: 'REQUEST_SENT',
        title: 't',
        message: 'm',
        readAt: null,
        createdAt: now,
      },
      {
        id: 'b',
        userId: otherUserId,
        type: 'REQUEST_SENT',
        title: 't',
        message: 'm',
        readAt: null,
        createdAt: now,
      },
    ];
    await expect(service.unreadCount(userId)).resolves.toEqual({ unreadCount: 1 });
    await expect(service.markAllRead(userId)).resolves.toEqual({ unreadCount: 0 });
    expect(repository.rows[0]!.readAt).not.toBeNull();
    expect(repository.rows[1]!.readAt).toBeNull();
  });

  it('refuses to mark another Users notification as read', async () => {
    const { service, repository } = setup();
    repository.rows = [
      {
        id: 'a',
        userId: otherUserId,
        type: 'REQUEST_SENT',
        title: 't',
        message: 'm',
        readAt: null,
        createdAt: now,
      },
    ];
    await expect(service.markRead('a', userId)).rejects.toBeInstanceOf(ApiException);
    expect(repository.rows[0]!.readAt).toBeNull();
  });
});
