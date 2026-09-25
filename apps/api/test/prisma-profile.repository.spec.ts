import { describe, expect, it, vi } from 'vitest';
import type { EventEnvelope, ProfileUpdatedEventPayload } from '@campus-skill-exchange/contracts';
import { PrismaProfileRepository } from '../src/modules/users/prisma-profile.repository';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type { OutboxWriter } from '../src/platform/events/outbox-contracts';

const event: EventEnvelope<ProfileUpdatedEventPayload> = {
  eventId: '00000000-0000-4000-8000-000000000010',
  eventType: 'PROFILE_UPDATED',
  version: 1,
  occurredAt: '2026-09-24T00:00:00.000Z',
  actorId: '00000000-0000-4000-8000-000000000011',
  entityType: 'Profile',
  entityId: '00000000-0000-4000-8000-000000000012',
  correlationId: null,
  causationId: null,
  idempotencyKey: 'profile-update-test-1',
  payload: {
    profileId: '00000000-0000-4000-8000-000000000012',
    userId: '00000000-0000-4000-8000-000000000013',
    visibility: 'PUBLIC',
    changedFields: ['department'],
  },
};

const profileRow = {
  id: event.payload.profileId,
  userId: event.payload.userId,
  publicDisplayName: 'Ada',
  department: 'Computer Science',
  academicYear: null,
  institution: null,
  bio: null,
  profileImageUrl: null,
  interests: [],
  githubUrl: null,
  portfolioUrl: null,
  visibility: 'PUBLIC' as const,
  createdAt: new Date('2026-09-24T00:00:00.000Z'),
  updatedAt: new Date('2026-09-24T00:00:00.000Z'),
  user: { displayName: 'Ada Account' },
};

describe('PrismaProfileRepository', () => {
  it('writes the profile update and outbox event with the same transaction client', async () => {
    const transaction = {
      profile: {
        findUnique: vi.fn().mockResolvedValue({ id: profileRow.id }),
        update: vi.fn().mockResolvedValue(profileRow),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const outboxWriter: OutboxWriter = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const repository = new PrismaProfileRepository(
      prisma as unknown as PrismaService,
      outboxWriter,
    );

    const result = await repository.updateByUserId(
      profileRow.userId,
      { department: 'Computer Science' },
      event,
    );

    expect(result).toMatchObject({ id: profileRow.id, department: 'Computer Science' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(outboxWriter.enqueue).toHaveBeenCalledWith(event, transaction);
  });

  it('does not enqueue an event when the profile does not exist', async () => {
    const transaction = {
      profile: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const outboxWriter: OutboxWriter = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const repository = new PrismaProfileRepository(
      prisma as unknown as PrismaService,
      outboxWriter,
    );

    await expect(
      repository.updateByUserId(profileRow.userId, { department: 'Missing' }, event),
    ).resolves.toBeNull();
    expect(outboxWriter.enqueue).not.toHaveBeenCalled();
  });
});
