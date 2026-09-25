import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  createSessionRequestSchema,
  requestAcceptedEventDefinition,
  requestCancelledEventDefinition,
  requestDeclinedEventDefinition,
  requestSentEventDefinition,
  sessionRequestQuerySchema,
  updateSessionRequestSchema,
  type CreateSessionRequest,
  type EventEnvelope,
  type SessionRequest,
  type SessionRequestEventPayload,
  type SessionRequestStatus,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import {
  DuplicateSessionRequestError,
  REQUESTS_REPOSITORY,
  RequestRecipientNotFoundError,
  RequestSkillNotFoundError,
  type RequestsRepository,
  type SessionRequestRecord,
} from './requests.types';

@Injectable()
export class RequestsService {
  constructor(@Inject(REQUESTS_REPOSITORY) private readonly repository: RequestsRepository) {}

  async create(requesterUserId: string, input: unknown): Promise<SessionRequest> {
    const data = this.parse(createSessionRequestSchema, input);
    if (data.recipientUserId === requesterUserId) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'A User cannot request themselves.');
    }
    const id = randomUUID();
    try {
      const row = await this.repository.create(
        id,
        requesterUserId,
        data,
        this.createEvent(
          requesterUserId,
          id,
          requesterUserId,
          data,
          'PENDING',
          requestSentEventDefinition,
        ),
      );
      return this.toResponse(row);
    } catch (error) {
      this.rethrowCreateError(error);
    }
  }

  async list(
    userId: string,
    query: unknown,
  ): Promise<{ items: SessionRequest[]; total: number; page: number; limit: number }> {
    const data = this.parse(sessionRequestQuerySchema, query);
    const result = await this.repository.list(userId, data.page, data.limit);
    return {
      items: result.items.map((item) => this.toResponse(item)),
      total: result.total,
      page: data.page,
      limit: data.limit,
    };
  }

  async update(requestId: string, userId: string, input: unknown): Promise<SessionRequest> {
    const data = this.parse(updateSessionRequestSchema, input);
    const existing = await this.repository.findById(requestId);
    if (!existing) throw new ApiException(404, 'NOT_FOUND', 'The session request was not found.');
    this.assertCanTransition(existing, userId, data.status);
    if (existing.status !== 'PENDING') {
      throw new ApiException(409, 'CONFLICT', 'Only pending session requests can be changed.');
    }

    const definition = this.definitionFor(data.status);
    const updated = await this.repository.updateStatus(
      requestId,
      data.status,
      this.createEvent(
        userId,
        requestId,
        existing.requester.userId,
        {
          recipientUserId: existing.recipient.userId,
          skillId: existing.skill?.id,
        },
        data.status,
        definition,
      ),
    );
    if (!updated)
      throw new ApiException(
        409,
        'CONFLICT',
        'The session request changed before it could be updated.',
      );
    return this.toResponse(updated);
  }

  private assertCanTransition(
    request: SessionRequestRecord,
    userId: string,
    status: Exclude<SessionRequestStatus, 'PENDING'>,
  ): void {
    const allowed =
      (status === 'CANCELLED' && request.requester.userId === userId) ||
      ((status === 'ACCEPTED' || status === 'DECLINED') && request.recipient.userId === userId);
    if (!allowed) {
      throw new ApiException(403, 'FORBIDDEN', 'You cannot change this session request.');
    }
  }

  private definitionFor(status: Exclude<SessionRequestStatus, 'PENDING'>) {
    if (status === 'ACCEPTED') return requestAcceptedEventDefinition;
    if (status === 'DECLINED') return requestDeclinedEventDefinition;
    return requestCancelledEventDefinition;
  }

  private createEvent(
    actorId: string,
    requestId: string,
    requesterUserId: string,
    input: CreateSessionRequest | { recipientUserId: string; skillId?: string },
    status: SessionRequestStatus,
    definition: { name: string; version: number },
  ): EventEnvelope<SessionRequestEventPayload> {
    const eventId = randomUUID();
    return {
      eventId,
      eventType: definition.name,
      version: definition.version,
      occurredAt: new Date().toISOString(),
      actorId,
      entityType: 'SessionRequest',
      entityId: requestId,
      correlationId: null,
      causationId: null,
      idempotencyKey: `request-${status.toLowerCase()}:${requestId}:${eventId}`,
      payload: {
        requestId,
        requesterUserId,
        recipientUserId: input.recipientUserId,
        skillId: input.skillId ?? null,
        status,
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
    if (error instanceof DuplicateSessionRequestError) {
      throw new ApiException(409, 'CONFLICT', 'An active session request already exists.');
    }
    if (error instanceof RequestRecipientNotFoundError) {
      throw new ApiException(404, 'NOT_FOUND', 'The recipient is not available.');
    }
    if (error instanceof RequestSkillNotFoundError) {
      throw new ApiException(404, 'NOT_FOUND', 'The requested skill was not found.');
    }
    throw error;
  }

  private toResponse(record: SessionRequestRecord): SessionRequest {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
