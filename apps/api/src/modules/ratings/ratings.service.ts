import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  createRatingSchema,
  ratingSubmittedEventDefinition,
  type CreateRating,
  type EventEnvelope,
  type Rating,
  type RatingSubmittedEventPayload,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import {
  DuplicateRatingError,
  RATINGS_REPOSITORY,
  RatingParticipantError,
  RatingSelfError,
  RatingSessionNotEligibleError,
  type RatingRecord,
  type RatingSessionRecord,
  type RatingsRepository,
} from './ratings.types';

@Injectable()
export class RatingsService {
  constructor(@Inject(RATINGS_REPOSITORY) private readonly repository: RatingsRepository) {}

  async create(raterUserId: string, input: unknown): Promise<Rating> {
    const data = this.parse(createRatingSchema, input);
    const session = await this.requireParticipantSession(data.sessionId, raterUserId);
    this.assertCompleted(session);
    const ratedUserId =
      session.host.userId === raterUserId ? session.participant.userId : session.host.userId;
    if (ratedUserId === raterUserId) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'A User cannot rate themselves.');
    }
    const id = randomUUID();
    try {
      const row = await this.repository.create(
        id,
        raterUserId,
        data,
        this.createEvent(id, data, raterUserId, ratedUserId),
      );
      return this.toResponse(row);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async listForSession(sessionId: string, userId: string): Promise<Rating[]> {
    const session = await this.repository.findSession(sessionId);
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    this.assertParticipant(session, userId);
    this.assertCompleted(session);
    return (await this.repository.listForSession(sessionId)).map((item) => this.toResponse(item));
  }

  private async requireParticipantSession(
    sessionId: string,
    userId: string,
  ): Promise<RatingSessionRecord> {
    const session = await this.repository.findSession(sessionId);
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    this.assertParticipant(session, userId);
    return session;
  }

  private assertParticipant(session: RatingSessionRecord, userId: string): void {
    if (session.host.userId !== userId && session.participant.userId !== userId) {
      throw new ApiException(403, 'FORBIDDEN', 'Only Session participants can access ratings.');
    }
  }

  private assertCompleted(session: RatingSessionRecord): void {
    if (session.status !== 'COMPLETED') {
      throw new ApiException(409, 'CONFLICT', 'Only completed Sessions can be rated.');
    }
  }

  private createEvent(
    id: string,
    input: CreateRating,
    raterUserId: string,
    ratedUserId: string,
  ): EventEnvelope<RatingSubmittedEventPayload> {
    const eventId = randomUUID();
    return {
      eventId,
      eventType: ratingSubmittedEventDefinition.name,
      version: ratingSubmittedEventDefinition.version,
      occurredAt: new Date().toISOString(),
      actorId: raterUserId,
      entityType: 'Rating',
      entityId: id,
      correlationId: null,
      causationId: null,
      idempotencyKey: `rating-submitted:${id}:${eventId}`,
      payload: {
        ratingId: id,
        sessionId: input.sessionId,
        raterUserId,
        ratedUserId,
        rating: input.rating,
      },
    };
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success || result.data === undefined) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    }
    return result.data;
  }

  private rethrow(error: unknown): never {
    if (error instanceof DuplicateRatingError) {
      throw new ApiException(
        409,
        'CONFLICT',
        'A rating already exists for this rater and session.',
      );
    }
    if (error instanceof RatingSessionNotEligibleError) {
      throw new ApiException(409, 'CONFLICT', 'Only completed Sessions can be rated.');
    }
    if (error instanceof RatingParticipantError) {
      throw new ApiException(403, 'FORBIDDEN', 'Only Session participants can rate this Session.');
    }
    if (error instanceof RatingSelfError) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'A User cannot rate themselves.');
    }
    throw error;
  }

  private toResponse(record: RatingRecord): Rating {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
