import { describe, expect, it } from 'vitest';
import { RatingsService } from '../src/modules/ratings/ratings.service';
import {
  DuplicateRatingError,
  type RatingRecord,
  type RatingSessionRecord,
  type RatingsRepository,
} from '../src/modules/ratings/ratings.types';
import type {
  CreateRating,
  EventEnvelope,
  RatingSubmittedEventPayload,
} from '@campus-skill-exchange/contracts';

const hostId = '00000000-0000-4000-8000-000000000001';
const partnerId = '00000000-0000-4000-8000-000000000002';
const unrelatedId = '00000000-0000-4000-8000-000000000003';
const sessionId = '00000000-0000-4000-8000-000000000004';
const now = new Date('2026-09-30T12:00:00.000Z');
const input: CreateRating = { sessionId, rating: 5, feedback: 'Great session' };

class FakeRatingsRepository implements RatingsRepository {
  session: RatingSessionRecord = {
    id: sessionId,
    status: 'COMPLETED',
    host: { userId: hostId, displayName: 'Host' },
    participant: { userId: partnerId, displayName: 'Partner' },
  };
  readonly events: EventEnvelope<RatingSubmittedEventPayload>[] = [];
  private readonly ratings: RatingRecord[] = [];

  async findSession(id: string): Promise<RatingSessionRecord | null> {
    return id === sessionId ? this.session : null;
  }
  async listForSession(id: string): Promise<RatingRecord[]> {
    return this.ratings.filter((rating) => rating.sessionId === id);
  }
  async create(
    id: string,
    raterUserId: string,
    data: CreateRating,
    event: EventEnvelope<RatingSubmittedEventPayload>,
  ): Promise<RatingRecord> {
    if (
      this.ratings.some(
        (rating) => rating.sessionId === data.sessionId && rating.rater.userId === raterUserId,
      )
    ) {
      throw new DuplicateRatingError();
    }
    const row: RatingRecord = {
      id,
      sessionId: data.sessionId,
      rater: { userId: raterUserId, displayName: 'Rater' },
      ratedUser: {
        userId: raterUserId === hostId ? partnerId : hostId,
        displayName: 'Rated partner',
      },
      rating: data.rating,
      feedback: data.feedback ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.ratings.push(row);
    this.events.push(event);
    return row;
  }
}

function serviceWithRepository() {
  const repository = new FakeRatingsRepository();
  return { repository, service: new RatingsService(repository) };
}

describe('RatingsService', () => {
  it('requires a completed session and participant authorization', async () => {
    const { repository, service } = serviceWithRepository();
    await expect(service.create(unrelatedId, input)).rejects.toThrow();
    await expect(service.listForSession(sessionId, unrelatedId)).rejects.toThrow();
    repository.session.status = 'SCHEDULED';
    await expect(service.create(hostId, input)).rejects.toThrow();
    await expect(service.listForSession(sessionId, hostId)).rejects.toThrow();
  });

  it('rejects self-rating and invalid ratings', async () => {
    const { repository, service } = serviceWithRepository();
    repository.session.participant = { userId: hostId, displayName: 'Host' };
    await expect(service.create(hostId, input)).rejects.toThrow();
    await expect(service.create(hostId, { ...input, rating: 0 })).rejects.toThrow();
  });

  it('creates a rating, emits RATING_SUBMITTED, and rejects duplicates', async () => {
    const { repository, service } = serviceWithRepository();
    const result = await service.create(hostId, input);
    expect(result).toMatchObject({
      sessionId,
      rating: 5,
      rater: { userId: hostId },
      ratedUser: { userId: partnerId },
    });
    expect(repository.events[0]).toMatchObject({
      eventType: 'RATING_SUBMITTED',
      actorId: hostId,
      payload: { rating: 5 },
    });
    await expect(service.create(hostId, input)).rejects.toThrow();
  });

  it('lists ratings for a participant session', async () => {
    const { service } = serviceWithRepository();
    await service.create(hostId, input);
    const result = await service.listForSession(sessionId, partnerId);
    expect(result).toHaveLength(1);
    expect(result[0]?.feedback).toBe('Great session');
  });
});
