import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { BadgeEarnedEventPayload, EventEnvelope } from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import {
  BadgeDefinitionNotFoundError,
  BadgeUserNotFoundError,
  DuplicateBadgeCodeError,
  type AwardBadgeResult,
  type BadgeDefinitionRecord,
  type BadgesRepository,
  type CreateBadgeDefinitionInput,
  type UserBadgeRecord,
} from './badges.types';

const userBadgeInclude = {
  badgeDefinition: true,
} satisfies Prisma.UserBadgeInclude;

type UserBadgeWithDefinition = Prisma.UserBadgeGetPayload<{
  include: typeof userBadgeInclude;
}>;

@Injectable()
export class PrismaBadgesRepository implements BadgesRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async createBadgeDefinition(input: CreateBadgeDefinitionInput): Promise<BadgeDefinitionRecord> {
    try {
      const row = await this.prisma.badgeDefinition.create({
        data: {
          id: randomUUID(),
          name: input.name,
          description: input.description,
          code: input.code,
          iconUrl: input.iconUrl ?? null,
        },
      });
      return this.mapDefinition(row);
    } catch (error) {
      if (this.isUnique(error)) throw new DuplicateBadgeCodeError();
      throw error;
    }
  }

  async listDefinitions(): Promise<BadgeDefinitionRecord[]> {
    const rows = await this.prisma.badgeDefinition.findMany({
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.mapDefinition(row));
  }

  async awardBadge(
    id: string,
    userId: string,
    badgeDefinitionId: string,
    event: EventEnvelope<BadgeEarnedEventPayload>,
    awardedAt = new Date(),
  ): Promise<AwardBadgeResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [user, definition, existing] = await Promise.all([
          tx.user.findUnique({ where: { id: userId }, select: { id: true } }),
          tx.badgeDefinition.findUnique({ where: { id: badgeDefinitionId }, select: { id: true } }),
          tx.userBadge.findUnique({
            where: { userId_badgeDefinitionId: { userId, badgeDefinitionId } },
            include: userBadgeInclude,
          }),
        ]);
        if (!user) throw new BadgeUserNotFoundError();
        if (!definition) throw new BadgeDefinitionNotFoundError();
        if (existing) return { badge: this.mapUserBadge(existing), created: false };

        const row = await tx.userBadge.create({
          data: {
            id,
            userId,
            badgeDefinitionId,
            awardedAt,
          },
          include: userBadgeInclude,
        });
        await this.outboxWriter.enqueue(event, tx);
        return { badge: this.mapUserBadge(row), created: true };
      });
    } catch (error) {
      if (this.isUserBadgeUniqueError(error)) {
        const existing = await this.prisma.userBadge.findUnique({
          where: { userId_badgeDefinitionId: { userId, badgeDefinitionId } },
          include: userBadgeInclude,
        });
        if (existing) return { badge: this.mapUserBadge(existing), created: false };
      }
      throw error;
    }
  }

  async listForUser(userId: string): Promise<UserBadgeRecord[]> {
    const rows = await this.prisma.userBadge.findMany({
      where: { userId },
      include: userBadgeInclude,
      orderBy: [{ awardedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.mapUserBadge(row));
  }

  private mapDefinition(row: {
    id: string;
    name: string;
    description: string;
    code: string;
    iconUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): BadgeDefinitionRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      code: row.code,
      iconUrl: row.iconUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapUserBadge(row: UserBadgeWithDefinition): UserBadgeRecord {
    return {
      id: row.id,
      userId: row.userId,
      badgeDefinitionId: row.badgeDefinitionId,
      awardedAt: row.awardedAt,
      badgeDefinition: this.mapDefinition(row.badgeDefinition),
    };
  }

  private isUnique(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private isUserBadgeUniqueError(error: unknown): boolean {
    if (!this.isUnique(error)) return false;
    const target =
      typeof error === 'object' && error !== null && 'meta' in error
        ? (error as { meta?: { target?: unknown } }).meta?.target
        : undefined;
    if (target === undefined) return true;
    if (Array.isArray(target)) {
      return target.includes('user_id') && target.includes('badge_definition_id');
    }
    return (
      typeof target === 'string' &&
      (target.includes('user_badges_user_id_badge_definition_id_key') ||
        (target.includes('user_id') && target.includes('badge_definition_id')))
    );
  }
}
