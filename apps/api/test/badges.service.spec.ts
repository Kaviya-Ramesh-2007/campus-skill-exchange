import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';
import { BadgesService } from '../src/modules/badges/badges.service';
import {
  BadgeDefinitionNotFoundError,
  BadgeUserNotFoundError,
  DuplicateUserBadgeError,
  type AwardBadgeResult,
  type BadgeDefinitionRecord,
  type BadgesRepository,
  type UserBadgeRecord,
} from '../src/modules/badges/badges.types';
import type {
  AuthUser,
  BadgeEarnedEventPayload,
  EventEnvelope,
} from '@campus-skill-exchange/contracts';

const userId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const definitionId = '00000000-0000-4000-8000-000000000003';
const now = new Date('2026-10-01T12:00:00.000Z');
const definition: BadgeDefinitionRecord = {
  id: definitionId,
  name: 'First Session',
  description: 'Completed a first learning session.',
  code: 'FIRST_SESSION',
  iconUrl: null,
  createdAt: now,
  updatedAt: now,
};
const user: AuthUser = {
  id: userId,
  email: 'user@example.test',
  displayName: 'User',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: now.toISOString(),
};
const otherUser: AuthUser = { ...user, id: otherUserId, email: 'other@example.test' };
const admin: AuthUser = { ...user, roles: ['USER', 'ADMIN'] };

class FakeBadgesRepository implements BadgesRepository {
  readonly definitions = [definition];
  readonly users = new Set([userId, otherUserId]);
  readonly events: EventEnvelope<BadgeEarnedEventPayload>[] = [];
  throwDuplicateOnNextAward = false;
  private readonly badges: UserBadgeRecord[] = [];

  async createBadgeDefinition(input: {
    name: string;
    description: string;
    code: string;
    iconUrl?: string | null;
  }) {
    const row: BadgeDefinitionRecord = {
      id: '00000000-0000-4000-8000-000000000004',
      ...input,
      iconUrl: input.iconUrl ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.definitions.push(row);
    return row;
  }

  async listDefinitions(): Promise<BadgeDefinitionRecord[]> {
    return [...this.definitions];
  }

  async awardBadge(
    id: string,
    recipientId: string,
    awardedDefinitionId: string,
    event: EventEnvelope<BadgeEarnedEventPayload>,
    awardedAt = new Date(),
  ): Promise<AwardBadgeResult> {
    if (this.throwDuplicateOnNextAward) {
      this.throwDuplicateOnNextAward = false;
      throw new DuplicateUserBadgeError();
    }
    if (!this.users.has(recipientId)) throw new BadgeUserNotFoundError();
    const badgeDefinition = this.definitions.find((item) => item.id === awardedDefinitionId);
    if (!badgeDefinition) throw new BadgeDefinitionNotFoundError();
    const existing = this.badges.find(
      (badge) => badge.userId === recipientId && badge.badgeDefinitionId === awardedDefinitionId,
    );
    if (existing) return { badge: existing, created: false };

    const badge: UserBadgeRecord = {
      id,
      userId: recipientId,
      badgeDefinitionId: awardedDefinitionId,
      awardedAt,
      badgeDefinition,
    };
    this.badges.push(badge);
    this.events.push(event);
    return { badge, created: true };
  }

  async listForUser(id: string): Promise<UserBadgeRecord[]> {
    return this.badges.filter((badge) => badge.userId === id);
  }
}

function setup() {
  const repository = new FakeBadgesRepository();
  const service = new BadgesService(repository, new SystemRoleAuthorizationPolicy());
  return { repository, service };
}

describe('BadgesService', () => {
  it('lists available badge definitions', async () => {
    const { service } = setup();
    await expect(service.listDefinitions()).resolves.toEqual([
      expect.objectContaining({
        id: definitionId,
        code: definition.code,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    ]);
  });

  it('retrieves badges for the owner or an ADMIN only', async () => {
    const { service } = setup();
    await service.awardBadge(userId, definitionId);

    await expect(service.listUserBadges(user, userId)).resolves.toHaveLength(1);
    await expect(service.listUserBadges(admin, userId)).resolves.toHaveLength(1);
    await expect(service.listUserBadges(otherUser, userId)).rejects.toBeInstanceOf(ApiException);
  });

  it('awards a badge and emits BADGE_EARNED for a new award', async () => {
    const { repository, service } = setup();
    const result = await service.awardBadge(userId, definitionId);

    expect(result).toMatchObject({
      id: expect.any(String),
      userId,
      badgeDefinitionId: definitionId,
      badgeDefinition: { code: definition.code },
      awardedAt: expect.any(String),
    });
    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]).toMatchObject({
      eventType: 'BADGE_EARNED',
      actorId: null,
      entityType: 'UserBadge',
      payload: { userId, badgeDefinitionId: definitionId },
    });
  });

  it('is idempotent when the same badge is awarded twice', async () => {
    const { repository, service } = setup();
    const first = await service.awardBadge(userId, definitionId);
    const second = await service.awardBadge(userId, definitionId);

    expect(second.id).toBe(first.id);
    expect(repository.events).toHaveLength(1);
  });

  it('rejects invalid recipients, definitions, and identifiers', async () => {
    const { repository, service } = setup();
    repository.users.delete(userId);
    await expect(service.awardBadge(userId, definitionId)).rejects.toBeInstanceOf(ApiException);

    const { service: validService } = setup();
    await expect(
      validService.awardBadge(userId, '00000000-0000-4000-8000-000000000099'),
    ).rejects.toBeInstanceOf(ApiException);
    await expect(validService.awardBadge('not-a-uuid', definitionId)).rejects.toBeInstanceOf(
      ApiException,
    );
  });

  it('can recover idempotently from a repository duplicate signal', async () => {
    const { repository, service } = setup();
    const first = await service.awardBadge(userId, definitionId);
    repository.throwDuplicateOnNextAward = true;

    const second = await service.awardBadge(userId, definitionId);
    expect(second.id).toBe(first.id);
  });
});
