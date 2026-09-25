import { describe, expect, it, vi } from 'vitest';
import { PrismaBadgesRepository } from '../src/modules/badges/prisma-badges.repository';
import {
  BadgeDefinitionNotFoundError,
  BadgeUserNotFoundError,
  DuplicateBadgeCodeError,
} from '../src/modules/badges/badges.types';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type { BadgeEarnedEventPayload, EventEnvelope } from '@campus-skill-exchange/contracts';

const definitionId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const userBadgeId = '00000000-0000-4000-8000-000000000003';
const now = new Date('2026-10-01T12:00:00.000Z');
const definitionRow = {
  id: definitionId,
  name: 'First Session',
  description: 'Completed a first learning session.',
  code: 'FIRST_SESSION',
  iconUrl: null,
  createdAt: now,
  updatedAt: now,
};
const userBadgeRow = {
  id: userBadgeId,
  userId,
  badgeDefinitionId: definitionId,
  awardedAt: now,
  badgeDefinition: definitionRow,
};
const event: EventEnvelope<BadgeEarnedEventPayload> = {
  eventId: '00000000-0000-4000-8000-000000000004',
  eventType: 'BADGE_EARNED',
  version: 1,
  occurredAt: now.toISOString(),
  actorId: null,
  entityType: 'UserBadge',
  entityId: userBadgeId,
  correlationId: null,
  causationId: null,
  idempotencyKey: `badge-earned:${userBadgeId}`,
  payload: {
    userBadgeId,
    userId,
    badgeDefinitionId: definitionId,
  },
};

function setup() {
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: userId }),
    },
    badgeDefinition: {
      findUnique: vi.fn().mockResolvedValue({ id: definitionId }),
    },
    userBadge: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(userBadgeRow),
    },
  };
  const badgeDefinition = {
    create: vi.fn().mockResolvedValue(definitionRow),
    findMany: vi.fn().mockResolvedValue([definitionRow]),
  };
  const userBadge = {
    findMany: vi.fn().mockResolvedValue([userBadgeRow]),
    findUnique: vi.fn().mockResolvedValue(null),
  };
  const prisma = {
    badgeDefinition,
    userBadge,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const repository = new PrismaBadgesRepository(prisma, outbox);
  return { repository, tx, badgeDefinition, userBadge, outbox };
}

describe('PrismaBadgesRepository', () => {
  it('creates and lists badge definitions', async () => {
    const { repository, badgeDefinition } = setup();
    const created = await repository.createBadgeDefinition({
      name: definitionRow.name,
      description: definitionRow.description,
      code: definitionRow.code,
    });
    const definitions = await repository.listDefinitions();

    expect(badgeDefinition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        name: definitionRow.name,
        description: definitionRow.description,
        code: definitionRow.code,
        iconUrl: null,
      }),
    });
    expect(created).toMatchObject({ id: definitionId, code: definitionRow.code });
    expect(definitions).toHaveLength(1);
    expect(badgeDefinition.findMany).toHaveBeenCalledWith({
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
  });

  it('rejects a duplicate badge code', async () => {
    const { repository, badgeDefinition } = setup();
    badgeDefinition.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      repository.createBadgeDefinition({
        name: definitionRow.name,
        description: definitionRow.description,
        code: definitionRow.code,
      }),
    ).rejects.toBeInstanceOf(DuplicateBadgeCodeError);
  });

  it('awards a badge and enqueues BADGE_EARNED in the same transaction', async () => {
    const { repository, tx, outbox } = setup();
    const result = await repository.awardBadge(userBadgeId, userId, definitionId, event, now);

    expect(tx.userBadge.create).toHaveBeenCalledWith({
      data: {
        id: userBadgeId,
        userId,
        badgeDefinitionId: definitionId,
        awardedAt: now,
      },
      include: { badgeDefinition: true },
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(event, tx);
    expect(result).toMatchObject({
      created: true,
      badge: {
        id: userBadgeId,
        userId,
        badgeDefinitionId: definitionId,
        badgeDefinition: { id: definitionId, code: definitionRow.code },
      },
    });
  });

  it('returns an existing award without a duplicate event', async () => {
    const { repository, tx, outbox } = setup();
    tx.userBadge.findUnique.mockResolvedValue(userBadgeRow);

    const result = await repository.awardBadge(userBadgeId, userId, definitionId, event, now);

    expect(result).toMatchObject({ created: false, badge: { id: userBadgeId } });
    expect(tx.userBadge.create).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('rejects missing users and badge definitions', async () => {
    const { repository, tx } = setup();
    tx.user.findUnique.mockResolvedValue(null);
    await expect(
      repository.awardBadge(userBadgeId, userId, definitionId, event, now),
    ).rejects.toBeInstanceOf(BadgeUserNotFoundError);

    tx.user.findUnique.mockResolvedValue({ id: userId });
    tx.badgeDefinition.findUnique.mockResolvedValue(null);
    await expect(
      repository.awardBadge(userBadgeId, userId, definitionId, event, now),
    ).rejects.toBeInstanceOf(BadgeDefinitionNotFoundError);
  });

  it('retrieves a user badges with their definitions', async () => {
    const { repository, userBadge } = setup();
    const result = await repository.listForUser(userId);

    expect(userBadge.findMany).toHaveBeenCalledWith({
      where: { userId },
      include: { badgeDefinition: true },
      orderBy: [{ awardedAt: 'desc' }, { id: 'asc' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.badgeDefinition.code).toBe(definitionRow.code);
  });
});
