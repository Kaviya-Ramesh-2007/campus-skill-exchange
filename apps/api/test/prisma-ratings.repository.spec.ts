import { describe, expect, it, vi } from 'vitest';
import { PrismaRatingsRepository } from '../src/modules/ratings/prisma-ratings.repository';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type {
  CreateRating,
  EventEnvelope,
  RatingSubmittedEventPayload,
} from '@campus-skill-exchange/contracts';
import { DuplicateRatingError } from '../src/modules/ratings/ratings.types';

const sessionId = '00000000-0000-4000-8000-000000000001';
const hostId = '00000000-0000-4000-8000-000000000002';
const participantId = '00000000-0000-4000-8000-000000000003';
const ratingId = '00000000-0000-4000-8000-000000000004';
const now = new Date('2026-09-30T12:00:00.000Z');
const input: CreateRating = { sessionId, rating: 5, feedback: 'Great session' };
const event: EventEnvelope<RatingSubmittedEventPayload> = {
  eventId: '00000000-0000-4000-8000-000000000005',
  eventType: 'RATING_SUBMITTED',
  version: 1,
  occurredAt: now.toISOString(),
  actorId: hostId,
  entityType: 'Rating',
  entityId: ratingId,
  correlationId: null,
  causationId: null,
  idempotencyKey: `rating-submitted:${ratingId}`,
  payload: {
    ratingId,
    sessionId,
    raterUserId: hostId,
    ratedUserId: participantId,
    rating: 5,
  },
};

const ratingRow = {
  id: ratingId,
  sessionId,
  raterUserId: hostId,
  ratedUserId: participantId,
  rating: 5,
  feedback: 'Great session',
  createdAt: now,
  updatedAt: now,
  rater: { id: hostId, displayName: 'Host', profile: null },
  ratedUser: { id: participantId, displayName: 'Partner', profile: null },
};

function setup() {
  const tx = {
    learningSession: {
      findUnique: vi.fn().mockResolvedValue({
        id: sessionId,
        status: 'COMPLETED',
        hostUserId: hostId,
        participantUserId: participantId,
      }),
    },
    rating: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(ratingRow),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const repository = new PrismaRatingsRepository(prisma, outbox);
  return { repository, tx, outbox };
}

describe('PrismaRatingsRepository', () => {
  it('creates a safe rating and enqueues the event in the same transaction', async () => {
    const { repository, tx, outbox } = setup();
    const result = await repository.create(ratingId, hostId, input, event);

    expect(tx.rating.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: ratingId,
          sessionId,
          raterUserId: hostId,
          ratedUserId: participantId,
          rating: 5,
          feedback: 'Great session',
        }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(event, tx);
    expect(result).toMatchObject({
      id: ratingId,
      rater: { userId: hostId },
      ratedUser: { userId: participantId },
    });
  });

  it('maps a concurrent unique violation to a duplicate rating error', async () => {
    const { repository, tx } = setup();
    tx.rating.create.mockRejectedValue({ code: 'P2002' });

    await expect(repository.create(ratingId, hostId, input, event)).rejects.toBeInstanceOf(
      DuplicateRatingError,
    );
  });
});
