import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  assessmentSubmittedEventDefinition,
  createAssessmentSchema,
  idSchema,
  type Assessment,
  type AssessmentSubmittedEventPayload,
  type AuthenticatedIdentity,
  type AuthUser,
  type CreateAssessment,
  type EventEnvelope,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AUTHORIZATION_POLICY, type AuthorizationPolicy } from '../../platform/auth/auth-contracts';
import {
  AssessmentNotEligibleError,
  AssessmentNotFoundError,
  AssessmentParticipantError,
  AssessmentSelfError,
  AssessmentSkillMismatchError,
  ASSESSMENTS_REPOSITORY,
  DuplicateAssessmentError,
  type AssessmentRecord,
  type AssessmentSessionRecord,
  type AssessmentsRepository,
} from './assessments.types';

@Injectable()
export class AssessmentsService {
  constructor(
    @Inject(ASSESSMENTS_REPOSITORY) private readonly repository: AssessmentsRepository,
    @Inject(AUTHORIZATION_POLICY) private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async create(assessorUserId: string, input: unknown): Promise<Assessment> {
    const data = this.parse(createAssessmentSchema, input);
    const session = await this.requireParticipantSession(data.sessionId, assessorUserId);
    this.assertCompleted(session);
    const assessedUserId = this.otherParticipant(session, assessorUserId);
    if (assessedUserId === assessorUserId) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'A User cannot assess themselves.');
    }
    this.assertSkillMatchesSession(data, session);
    const id = randomUUID();
    try {
      const row = await this.repository.create(
        id,
        assessorUserId,
        data,
        this.createEvent(id, data, assessorUserId, assessedUserId, session.skillId),
      );
      return this.toResponse(row);
    } catch (error) {
      this.rethrow(error);
    }
  }

  async listForUser(actor: AuthUser, userId: string): Promise<Assessment[]> {
    this.assertUuid(userId, 'userId');
    this.assertCanRead(actor, userId);
    const rows = await this.repository.listForUser(userId);
    return rows.map((row) => this.toResponse(row));
  }

  async listForSession(actor: AuthUser, sessionId: string): Promise<Assessment[]> {
    this.assertUuid(sessionId, 'sessionId');
    const session = await this.repository.findSession(sessionId);
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    this.assertParticipant(session, actor.id);
    this.assertCompleted(session);
    const rows = await this.repository.listForSession(sessionId);
    return rows.map((row) => this.toResponse(row));
  }

  private async requireParticipantSession(
    sessionId: string,
    userId: string,
  ): Promise<AssessmentSessionRecord> {
    const session = await this.repository.findSession(sessionId);
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    this.assertParticipant(session, userId);
    return session;
  }

  private otherParticipant(session: AssessmentSessionRecord, userId: string): string {
    if (session.hostUserId === userId) return session.participantUserId;
    if (session.participantUserId === userId) return session.hostUserId;
    throw new ApiException(403, 'FORBIDDEN', 'Only Session participants can submit assessments.');
  }

  private assertParticipant(session: AssessmentSessionRecord, userId: string): void {
    if (session.hostUserId !== userId && session.participantUserId !== userId) {
      throw new ApiException(403, 'FORBIDDEN', 'Only Session participants can access assessments.');
    }
  }

  private assertCompleted(session: AssessmentSessionRecord): void {
    if (session.status !== 'COMPLETED') {
      throw new ApiException(409, 'CONFLICT', 'Only completed Sessions can be assessed.');
    }
  }

  private assertSkillMatchesSession(
    input: CreateAssessment,
    session: AssessmentSessionRecord,
  ): void {
    if (input.skillId === undefined || input.skillId === session.skillId) return;
    throw new ApiException(
      400,
      'VALIDATION_ERROR',
      'The assessment skill must match the Session skill.',
    );
  }

  private assertCanRead(actor: AuthUser, userId: string): void {
    const identity: AuthenticatedIdentity = {
      userId: actor.id,
      issuer: 'local-session',
      subject: actor.id,
      roles: actor.roles,
      claims: {},
    };
    const allowed = this.authorizationPolicy.can({
      request: { identity },
      action: 'read',
      resourceType: 'Assessment',
      resourceId: userId,
      ownerUserId: userId,
    });
    if (allowed) return;
    throw new ApiException(403, 'AUTH_FORBIDDEN', 'You may only view your own assessments.');
  }

  private assertUuid(value: string, field: string): void {
    if (idSchema.safeParse(value).success) return;
    throw new ApiException(400, 'VALIDATION_ERROR', `${field} must be a valid UUID.`);
  }

  private createEvent(
    id: string,
    input: CreateAssessment,
    assessorUserId: string,
    assessedUserId: string,
    sessionSkillId: string | null,
  ): EventEnvelope<AssessmentSubmittedEventPayload> {
    const eventId = randomUUID();
    return {
      eventId,
      eventType: assessmentSubmittedEventDefinition.name,
      version: assessmentSubmittedEventDefinition.version,
      occurredAt: new Date().toISOString(),
      actorId: assessorUserId,
      entityType: 'Assessment',
      entityId: id,
      correlationId: null,
      causationId: null,
      idempotencyKey: `assessment-submitted:${id}:${eventId}`,
      payload: {
        assessmentId: id,
        sessionId: input.sessionId,
        assessorUserId,
        assessedUserId,
        skillId: input.skillId ?? sessionSkillId,
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
    if (error instanceof AssessmentNotFoundError) {
      throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    }
    if (error instanceof AssessmentNotEligibleError) {
      throw new ApiException(409, 'CONFLICT', 'Only completed Sessions can be assessed.');
    }
    if (error instanceof AssessmentParticipantError) {
      throw new ApiException(403, 'FORBIDDEN', 'Only Session participants can submit assessments.');
    }
    if (error instanceof AssessmentSelfError) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'A User cannot assess themselves.');
    }
    if (error instanceof DuplicateAssessmentError) {
      throw new ApiException(
        409,
        'CONFLICT',
        'An assessment already exists for this Session and assessor.',
      );
    }
    if (error instanceof AssessmentSkillMismatchError) {
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'The assessment skill must match the Session skill.',
      );
    }
    throw error;
  }

  private toResponse(record: AssessmentRecord): Assessment {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
