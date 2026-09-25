import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import {
  DuplicateBadgeCodeError,
  DuplicateUserBadgeError,
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async awardBadge(
    userId: string,
    badgeDefinitionId: string,
    awardedAt = new Date(),
  ): Promise<UserBadgeRecord> {
    try {
      const row = await this.prisma.userBadge.create({
        data: {
          id: randomUUID(),
          userId,
          badgeDefinitionId,
          awardedAt,
        },
        include: userBadgeInclude,
      });
      return this.mapUserBadge(row);
    } catch (error) {
      if (this.isUnique(error)) throw new DuplicateUserBadgeError();
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
}
