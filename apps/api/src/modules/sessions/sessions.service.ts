import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  createSessionSchema,
  paidSessionTermsVersion,
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
import { GoogleIntegrationService } from '../integrations/google/google-integration.service';
import type { GoogleEventData, GoogleEventInput } from '../integrations/google/google.types';
import { PaymentsService } from '../payments/payments.service';
import {
  DuplicateSessionError,
  SESSIONS_REPOSITORY,
  SessionParticipantError,
  SessionRequestNotAcceptedError,
  type SessionRecord,
  type SessionRequestRecord,
  type SessionsRepository,
  type SessionUpdate,
} from './sessions.types';

@Injectable()
export class SessionsService {
  constructor(
    @Inject(SESSIONS_REPOSITORY) private readonly repository: SessionsRepository,
    @Optional()
    @Inject(GoogleIntegrationService)
    private readonly google?: GoogleIntegrationService,
    @Optional()
    @Inject(PaymentsService)
    private readonly payments?: PaymentsService,
  ) {}

  async create(actorUserId: string, input: unknown): Promise<Session> {
    const data = this.parse(createSessionSchema, input);
    const request = this.requireRequestForCreate(
      await this.repository.findRequest(data.sessionRequestId),
      actorUserId,
    );
    if (data.paymentMode === 'PAID') {
      await this.assertPaidSessionEligible(request.requesterUserId);
    }
    const id = randomUUID();
    const googleData =
      data.mode === 'ONLINE' ? await this.createGoogleEvent(actorUserId, id, request, data) : null;
    try {
      const row = await this.repository.create(
        id,
        actorUserId,
        data,
        this.createScheduledEvent(actorUserId, id, request, data, sessionScheduledEventDefinition),
        googleData,
      );
      return this.toResponse(row);
    } catch (error) {
      if (googleData && this.google) {
        try {
          await this.google.deleteEvent(actorUserId, googleData.eventId);
        } catch {
          // Preserve the original persistence error.
        }
      }
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
    if (existing.status !== 'SCHEDULED' && !data.status) {
      throw new ApiException(409, 'CONFLICT', 'Only scheduled Sessions can change agreed details.');
    }
    if (
      existing.status !== 'SCHEDULED' &&
      (data.locationDetails !== undefined ||
        data.meetingUrl !== undefined ||
        data.scheduledStart !== undefined ||
        data.scheduledEnd !== undefined ||
        data.timezone !== undefined)
    ) {
      throw new ApiException(409, 'CONFLICT', 'Only scheduled Sessions can change agreed details.');
    }
    if (data.status) this.assertTransition(existing.status, data.status);

    const paymentTermsChanged = data.paymentMode !== undefined || data.pricePaise !== undefined;
    if (paymentTermsChanged) {
      if (existing.status !== 'SCHEDULED') {
        throw new ApiException(
          409,
          'CONFLICT',
          'Only scheduled Sessions can change paid Session terms.',
        );
      }
      if (this.payments && (await this.payments.hasPaymentForSession(sessionId))) {
        throw new ApiException(
          409,
          'CONFLICT',
          'Paid Session terms cannot change once a payment has been started.',
        );
      }
    }
    const nextPaymentMode = data.paymentMode ?? existing.paymentMode;
    const nextPricePaise =
      data.paymentMode !== undefined || data.pricePaise !== undefined
        ? (data.pricePaise ?? null)
        : existing.pricePaise;
    if (nextPaymentMode === 'PAID' && (nextPricePaise === null || nextPricePaise <= 0)) {
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'PAID sessions require a positive pricePaise.',
      );
    }
    if (nextPaymentMode === 'PAID' && paymentTermsChanged) {
      // The host is whoever the SessionRequest authoriser turned into the host.
      await this.assertPaidSessionEligible(existing.host.userId);
    }
    const scheduledStart = data.scheduledStart
      ? new Date(data.scheduledStart)
      : existing.scheduledStart;
    const scheduledEnd = data.scheduledEnd ? new Date(data.scheduledEnd) : existing.scheduledEnd;
    if (scheduledStart.getTime() >= scheduledEnd.getTime()) {
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'scheduledStart must be before scheduledEnd.',
      );
    }
    const locationDetails =
      data.locationDetails !== undefined ? data.locationDetails : existing.locationDetails;
    if (existing.mode === 'OFFLINE' && !locationDetails) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'OFFLINE sessions require locationDetails.');
    }
    if (existing.mode === 'OFFLINE' && data.meetingUrl) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'OFFLINE sessions cannot use a meeting URL.');
    }
    const timezone = data.timezone ?? existing.timezone;
    const nextStatus = data.status ?? existing.status;
    const scheduleChanged =
      scheduledStart.getTime() !== existing.scheduledStart.getTime() ||
      scheduledEnd.getTime() !== existing.scheduledEnd.getTime();
    const nextForEvent: SessionRecord = {
      ...existing,
      status: nextStatus,
      scheduledStart,
      scheduledEnd,
      timezone,
    };
    const update: SessionUpdate = {
      ...(data.status ? { status: data.status } : {}),
      ...(data.locationDetails !== undefined ? { locationDetails } : {}),
      ...(data.meetingUrl !== undefined ? { meetingUrl: data.meetingUrl } : {}),
      ...(scheduleChanged ? { scheduledStart, scheduledEnd } : {}),
      ...(data.timezone !== undefined ? { timezone } : {}),
      ...(paymentTermsChanged
        ? {
            paymentMode: nextPaymentMode,
            pricePaise: nextPaymentMode === 'PAID' ? nextPricePaise : null,
            termsVersion: nextPaymentMode === 'PAID' ? paidSessionTermsVersion : null,
          }
        : {}),
    };
    const events = [
      this.createStatusEvent(userId, nextForEvent, nextStatus, sessionUpdatedEventDefinition),
      ...(data.status
        ? [
            this.createStatusEvent(
              userId,
              nextForEvent,
              data.status,
              this.definitionFor(data.status),
            ),
          ]
        : []),
    ];
    let googleData: GoogleEventData | null | undefined;
    if (existing.mode === 'ONLINE') {
      if (data.status === 'CANCELLED') {
        if (!this.google) {
          throw new ApiException(
            503,
            'DEPENDENCY_UNAVAILABLE',
            'Google integration is not available.',
          );
        }
        await this.google.deleteEvent(userId, existing.googleCalendarEventId);
        googleData = null;
      } else if (scheduleChanged) {
        if (!this.google || !existing.googleCalendarEventId) {
          throw new ApiException(409, 'CONFLICT', 'The Google Calendar event is not available.');
        }
        const attendees = this.repository.findParticipantEmails
          ? await this.repository.findParticipantEmails([
              existing.host.userId,
              existing.participant.userId,
            ])
          : [];
        googleData = await this.google.updateEvent(
          userId,
          existing.googleCalendarEventId,
          this.googleEventInput(
            sessionId,
            { scheduledStart, scheduledEnd, timezone },
            attendees.map((participant) => participant.email),
          ),
          {
            eventId: existing.googleCalendarEventId,
            conferenceId: existing.googleConferenceId,
            meetingUrl: existing.meetingUrl,
            conferenceStatus: existing.googleConferenceStatus ?? 'PENDING',
          },
        );
      }
    }
    const updated = await this.repository.update(
      sessionId,
      existing.status,
      update,
      events,
      scheduleChanged,
      googleData,
    );
    if (!updated)
      throw new ApiException(409, 'CONFLICT', 'The session changed before it could be updated.');
    return this.toResponse(updated);
  }

  private async assertPaidSessionEligible(hostUserId: string): Promise<void> {
    if (!this.payments) {
      throw new ApiException(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Paid Sessions are unavailable right now.',
      );
    }
    try {
      await this.payments.assertCanOfferPaidSession(hostUserId);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(
        403,
        'FORBIDDEN',
        'A verified certification is required to offer a PAID Session.',
      );
    }
  }

  private async createGoogleEvent(
    actorUserId: string,
    sessionId: string,
    request: SessionRequestRecord,
    input: CreateSession,
  ): Promise<GoogleEventData> {
    if (!this.google) {
      throw new ApiException(503, 'DEPENDENCY_UNAVAILABLE', 'Google integration is not available.');
    }
    const attendees = this.repository.findParticipantEmails
      ? await this.repository.findParticipantEmails([
          request.requesterUserId,
          request.recipientUserId,
        ])
      : [];
    return this.google.createEvent(
      actorUserId,
      this.googleEventInput(
        sessionId,
        {
          scheduledStart: new Date(input.scheduledStart),
          scheduledEnd: new Date(input.scheduledEnd),
          timezone: input.timezone,
        },
        attendees.map((participant) => participant.email),
      ),
    );
  }

  private googleEventInput(
    sessionId: string,
    session: { scheduledStart: Date; scheduledEnd: Date; timezone: string },
    attendeeEmails: string[],
  ): GoogleEventInput {
    return {
      sessionId,
      summary: 'Campus Skill Exchange Session',
      description: 'A skill exchange session scheduled through Campus Skill Exchange.',
      start: session.scheduledStart,
      end: session.scheduledEnd,
      timezone: session.timezone,
      attendeeEmails,
    };
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
