import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  createSessionSchema,
  sessionCancelledEventDefinition,
  sessionCompletedEventDefinition,
  sessionNoShowEventDefinition,
  sessionQuerySchema,
  sessionScheduledEventDefinition,
  sessionStartedEventDefinition,
  sessionUpdatedEventDefinition,
  updateSessionSchema,
  type CreateSession,
  type EventEnvelope,
  type Session,
  type SessionEventPayload,
  type SessionStatus,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import {
  DuplicateSessionError,
  SESSIONS_REPOSITORY,
  SessionParticipantError,
  SessionRequestNotAcceptedError,
  type SessionRecord,
  type SessionRequestRecord,
  type SessionsRepository,
} from './sessions.types';

@Injectable()
export class SessionsService {
  constructor(@Inject(SESSIONS_REPOSITORY) private readonly repository: SessionsRepository) {}

  async create(actorUserId: string, input: unknown): Promise<Session> {
    const data = this.parse(createSessionSchema, input);
    const request = this.requireRequestForCreate(
      await this.repository.findRequest(data.sessionRequestId),
      actorUserId,
    );
    const id = randomUUID();
    try {
      const row = await this.repository.create(
        id,
        actorUserId,
        data,
        this.createScheduledEvent(actorUserId, id, request, data, sessionScheduledEventDefinition),
      );
      return this.toResponse(row);
    } catch (error) {
      this.rethrowCreateError(error);
    }
  }

  async list(
    userId: string,
    query: unknown,
  ): Promise<{ items: Session[]; total: number; page: number; limit: number }> {
    const data = this.parse(sessionQuerySchema, query);
    const result = await this.repository.list(userId, data.page, data.limit);
    return {
      items: result.items.map((item) => this.toResponse(item)),
      total: result.total,
      page: data.page,
      limit: data.limit,
    };
  }

  async get(sessionId: string, userId: string): Promise<Session> {
    const session = await this.repository.findById(sessionId);
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    this.assertParticipant(session, userId);
    return this.toResponse(session);
  }

  async update(sessionId: string, userId: string, input: unknown): Promise<Session> {
    const data = this.parse(updateSessionSchema, input);
    const existing = await this.repository.findById(sessionId);
    if (!existing) throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    this.assertParticipant(existing, userId);
    this.assertTransition(existing.status, data.status);

    const updated = await this.repository.updateStatus(sessionId, existing.status, data.status, [
      this.createStatusEvent(userId, existing, data.status, sessionUpdatedEventDefinition),
      this.createStatusEvent(userId, existing, data.status, this.definitionFor(data.status)),
    ]);
    if (!updated)
      throw new ApiException(409, 'CONFLICT', 'The session changed before it could be updated.');
    return this.toResponse(updated);
  }

  private requireRequestForCreate(
    request: SessionRequestRecord | null,
    actorUserId: string,
  ): SessionRequestRecord {
    if (!request || request.status !== 'ACCEPTED') {
      throw new ApiException(
        409,
        'CONFLICT',
        'Only an accepted SessionRequest can create a Session.',
      );
    }
    if (request.requesterUserId === request.recipientUserId) {
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'A Session cannot have the same participant twice.',
      );
    }
    if (actorUserId !== request.requesterUserId && actorUserId !== request.recipientUserId) {
      throw new ApiException(
        403,
        'FORBIDDEN',
        'Only a SessionRequest participant can create a Session.',
      );
    }
    return request;
  }

  private assertParticipant(session: SessionRecord, userId: string): void {
    if (session.host.userId !== userId && session.participant.userId !== userId) {
      throw new ApiException(
        403,
        'FORBIDDEN',
        'Only a Session participant can access this Session.',
      );
    }
  }

  private assertTransition(from: SessionStatus, to: SessionStatus): void {
    const allowed: Record<SessionStatus, SessionStatus[]> = {
      SCHEDULED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
      NO_SHOW: [],
    };
    if (!allowed[from].includes(to)) {
      throw new ApiException(409, 'CONFLICT', 'That Session status transition is not allowed.');
    }
  }

  private definitionFor(status: SessionStatus) {
    if (status === 'IN_PROGRESS') return sessionStartedEventDefinition;
    if (status === 'COMPLETED') return sessionCompletedEventDefinition;
    if (status === 'CANCELLED') return sessionCancelledEventDefinition;
    return sessionNoShowEventDefinition;
  }

  private createScheduledEvent(
    actorId: string,
    id: string,
    request: SessionRequestRecord,
    input: CreateSession,
    definition: { name: string; version: number },
  ): EventEnvelope<SessionEventPayload> {
    return this.eventEnvelope(
      actorId,
      id,
      request.requesterUserId,
      request.recipientUserId,
      input.sessionRequestId,
      request.skillId,
      input.mode,
      'SCHEDULED',
      new Date(input.scheduledStart),
      new Date(input.scheduledEnd),
      input.timezone,
      definition,
    );
  }

  private createStatusEvent(
    actorId: string,
    session: SessionRecord,
    status: SessionStatus,
    definition: { name: string; version: number },
  ): EventEnvelope<SessionEventPayload> {
    return this.eventEnvelope(
      actorId,
      session.id,
      session.host.userId,
      session.participant.userId,
      session.sessionRequestId,
      session.skill?.id ?? null,
      session.mode,
      status,
      session.scheduledStart,
      session.scheduledEnd,
      session.timezone,
      definition,
    );
  }

  private eventEnvelope(
    actorId: string,
    sessionId: string,
    hostUserId: string,
    participantUserId: string,
    sessionRequestId: string,
    skillId: string | null,
    mode: SessionRecord['mode'],
    status: SessionStatus,
    scheduledStart: Date,
    scheduledEnd: Date,
    timezone: string,
    definition: { name: string; version: number },
  ): EventEnvelope<SessionEventPayload> {
    const eventId = randomUUID();
    return {
      eventId,
      eventType: definition.name,
      version: definition.version,
      occurredAt: new Date().toISOString(),
      actorId,
      entityType: 'LearningSession',
      entityId: sessionId,
      correlationId: null,
      causationId: null,
      idempotencyKey: `session-${status.toLowerCase()}:${sessionId}:${eventId}`,
      payload: {
        sessionId,
        sessionRequestId,
        hostUserId,
        participantUserId,
        skillId,
        mode,
        status,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        timezone,
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

  private rethrowCreateError(error: unknown): never {
    if (error instanceof SessionRequestNotAcceptedError) {
      throw new ApiException(
        409,
        'CONFLICT',
        'Only an accepted SessionRequest can create a Session.',
      );
    }
    if (error instanceof SessionParticipantError) {
      throw new ApiException(
        403,
        'FORBIDDEN',
        'Only a SessionRequest participant can create a Session.',
      );
    }
    if (error instanceof DuplicateSessionError) {
      throw new ApiException(409, 'CONFLICT', 'A Session already exists for this SessionRequest.');
    }
    throw error;
  }

  private toResponse(record: SessionRecord): Session {
    return {
      ...record,
      scheduledStart: record.scheduledStart.toISOString(),
      scheduledEnd: record.scheduledEnd.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
