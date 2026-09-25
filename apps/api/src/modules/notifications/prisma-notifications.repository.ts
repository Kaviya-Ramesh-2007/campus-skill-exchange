import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NotificationType } from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import {
  type NotificationListResult,
  type NotificationRecord,
  type NotificationsRepository,
} from './notifications.types';

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createMany(
    rows: {
      id: string;
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      sourceEventId: string;
    }[],
    client?: PrismaService | Prisma.TransactionClient,
  ): Promise<void> {
    if (rows.length === 0) return;
    const database = client ?? this.prisma;
    // skipDuplicates keeps this safe under event replay.
    await database.notification.createMany({ data: rows, skipDuplicates: true });
  }

  async list(userId: string, page: number, limit: number): Promise<NotificationListResult> {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string): Promise<NotificationRecord | null> {
    // The userId predicate makes this owner-scoped: a User can never read
    // another User's notification by guessing an id.
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (updated.count === 0) {
      const existing = await this.prisma.notification.findFirst({ where: { id, userId } });
      return existing;
    }
    return this.prisma.notification.findFirst({ where: { id, userId } });
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return updated.count;
  }

  private isKnown(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}

export function newNotificationId(): string {
  return randomUUID();
}
