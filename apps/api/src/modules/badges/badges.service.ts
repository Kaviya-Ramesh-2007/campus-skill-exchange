import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  badgeEarnedEventDefinition,
  idSchema,
  type AuthenticatedIdentity,
  type AuthUser,
  type BadgeDefinition as BadgeDefinitionResponse,
  type BadgeEarnedEventPayload,
  type EventEnvelope,
  type UserBadge as UserBadgeResponse,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AUTHORIZATION_POLICY, type AuthorizationPolicy } from '../../platform/auth/auth-contracts';
import {
  BadgeDefinitionNotFoundError,
  BadgeUserNotFoundError,
  BADGES_REPOSITORY,
  DuplicateUserBadgeError,
  type BadgesRepository,
} from './badges.types';

@Injectable()
export class BadgesService {
  constructor(
    @Inject(BADGES_REPOSITORY) private readonly repository: BadgesRepository,
    @Inject(AUTHORIZATION_POLICY) private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async listDefinitions(): Promise<BadgeDefinitionResponse[]> {
    const definitions = await this.repository.listDefinitions();
    return definitions.map((definition) => this.toDefinitionResponse(definition));
  }

  async listUserBadges(actor: AuthUser, userId: string): Promise<UserBadgeResponse[]> {
    this.assertUuid(userId, 'userId');
    this.assertCanRead(actor, userId);
    const badges = await this.repository.listForUser(userId);
    return badges.map((badge) => this.toUserBadgeResponse(badge));
  }

  /**
   * Controlled application-service entry point for future event-driven awards.
   * There is intentionally no public HTTP award route.
   */
  async awardBadge(userId: string, badgeDefinitionId: string): Promise<UserBadgeResponse> {
    this.assertUuid(userId, 'userId');
    this.assertUuid(badgeDefinitionId, 'badgeDefinitionId');
    const id = randomUUID();
    try {
      const result = await this.repository.awardBadge(
        id,
        userId,
        badgeDefinitionId,
        this.createEarnedEvent(id, userId, badgeDefinitionId),
      );
      return this.toUserBadgeResponse(result.badge);
    } catch (error) {
      if (error instanceof DuplicateUserBadgeError) {
        const existing = (await this.repository.listForUser(userId)).find(
          (badge) => badge.badgeDefinitionId === badgeDefinitionId,
        );
        if (existing) return this.toUserBadgeResponse(existing);
      }
      this.rethrow(error);
    }
  }

  private assertCanRead(actor: AuthUser, userId: string): void {
    const identity: AuthenticatedIdentity = {
      userId: actor.id,
      issuer: 'local-session',
      subject: actor.id,
      roles: actor.roles,
      claims: {},
    };
    const allowed = this.authorizationPolicy.can({
      request: { identity },
      action: 'read',
      resourceType: 'Badge',
      resourceId: userId,
      ownerUserId: userId,
    });
    if (allowed) return;
    throw new ApiException(403, 'AUTH_FORBIDDEN', 'You may only view your own badges.');
  }

  private assertUuid(value: string, field: string): void {
    if (idSchema.safeParse(value).success) return;
    throw new ApiException(400, 'VALIDATION_ERROR', `${field} must be a valid UUID.`);
  }

  private createEarnedEvent(
    userBadgeId: string,
    userId: string,
    badgeDefinitionId: string,
  ): EventEnvelope<BadgeEarnedEventPayload> {
    const eventId = randomUUID();
    return {
      eventId,
      eventType: badgeEarnedEventDefinition.name,
      version: badgeEarnedEventDefinition.version,
      occurredAt: new Date().toISOString(),
      actorId: null,
      entityType: 'UserBadge',
      entityId: userBadgeId,
      correlationId: null,
      causationId: null,
      idempotencyKey: `badge-earned:${userBadgeId}:${eventId}`,
      payload: { userBadgeId, userId, badgeDefinitionId },
    };
  }

  private toDefinitionResponse(record: {
    id: string;
    name: string;
    description: string;
    code: string;
    iconUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): BadgeDefinitionResponse {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toUserBadgeResponse(record: {
    id: string;
    userId: string;
    badgeDefinitionId: string;
    awardedAt: Date;
    badgeDefinition: {
      id: string;
      name: string;
      description: string;
      code: string;
      iconUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }): UserBadgeResponse {
    return {
      id: record.id,
      userId: record.userId,
      badgeDefinitionId: record.badgeDefinitionId,
      awardedAt: record.awardedAt.toISOString(),
      badgeDefinition: this.toDefinitionResponse(record.badgeDefinition),
    };
  }

  private rethrow(error: unknown): never {
    if (error instanceof BadgeUserNotFoundError) {
      throw new ApiException(404, 'NOT_FOUND', 'The badge recipient was not found.');
    }
    if (error instanceof BadgeDefinitionNotFoundError) {
      throw new ApiException(404, 'NOT_FOUND', 'The badge definition was not found.');
    }
    throw error;
  }
}
