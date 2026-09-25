import { describe, expect, it, vi } from 'vitest';
import { PrismaBadgesRepository } from '../src/modules/badges/prisma-badges.repository';
import {
  DuplicateBadgeCodeError,
  DuplicateUserBadgeError,
} from '../src/modules/badges/badges.types';
import type { PrismaService } from '../src/platform/database/prisma.service';

const definitionId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
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
  id: '00000000-0000-4000-8000-000000000003',
  userId,
  badgeDefinitionId: definitionId,
  awardedAt: now,
  badgeDefinition: definitionRow,
};

function setup() {
  const badgeDefinition = {
    create: vi.fn().mockResolvedValue(definitionRow),
  };
  const userBadge = {
    create: vi.fn().mockResolvedValue(userBadgeRow),
    findMany: vi.fn().mockResolvedValue([userBadgeRow]),
  };
  const prisma = { badgeDefinition, userBadge } as unknown as PrismaService;
  const repository = new PrismaBadgesRepository(prisma);
  return { repository, badgeDefinition, userBadge };
}

describe('PrismaBadgesRepository', () => {
  it('creates a badge definition', async () => {
    const { repository, badgeDefinition } = setup();
    const result = await repository.createBadgeDefinition({
      name: definitionRow.name,
      description: definitionRow.description,
      code: definitionRow.code,
    });

    expect(badgeDefinition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        name: definitionRow.name,
        description: definitionRow.description,
        code: definitionRow.code,
        iconUrl: null,
      }),
    });
    expect(result).toMatchObject({ id: definitionId, code: definitionRow.code });
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

  it('awards a badge to a user', async () => {
    const { repository, userBadge } = setup();
    const result = await repository.awardBadge(userId, definitionId, now);

    expect(userBadge.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        userId,
        badgeDefinitionId: definitionId,
        awardedAt: now,
      },
      include: { badgeDefinition: true },
    });
    expect(result).toMatchObject({
      userId,
      badgeDefinitionId: definitionId,
      badgeDefinition: { id: definitionId, code: definitionRow.code },
    });
  });

  it('rejects a duplicate user badge', async () => {
    const { repository, userBadge } = setup();
    userBadge.create.mockRejectedValue({ code: 'P2002' });

    await expect(repository.awardBadge(userId, definitionId, now)).rejects.toBeInstanceOf(
      DuplicateUserBadgeError,
    );
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

  it('preserves foreign-key errors for invalid user or badge references', async () => {
    const { repository, userBadge } = setup();
    const foreignKeyError = { code: 'P2003', meta: { field_name: 'user_badges_user_id_fkey' } };
    userBadge.create.mockRejectedValue(foreignKeyError);

    await expect(repository.awardBadge(userId, definitionId, now)).rejects.toBe(foreignKeyError);
  });
});
