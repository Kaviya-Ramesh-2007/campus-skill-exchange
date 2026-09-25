import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  authUserSchema,
  eventEnvelopeSchema,
  paginationQuerySchema,
  profileResponseSchema,
  profileUpdatedEventDefinition,
  registerRequestSchema,
  systemRoleSchema,
  createProfileRequestSchema,
  updateProfileRequestSchema,
  createLearningGoalRequestSchema,
  createAvailabilityRequestSchema,
  createCertificationRequestSchema,
  createProjectRequestSchema,
  discoveryUserQuerySchema,
  discoveryUserSchema,
  matchingQuerySchema,
  matchingUserSchema,
  mutualExchangeSchema,
  createSessionRequestSchema,
  updateSessionRequestSchema,
  sessionRequestSchema,
  requestSentEventDefinition,
  requestAcceptedEventDefinition,
  requestDeclinedEventDefinition,
  requestCancelledEventDefinition,
  createSessionSchema,
  sessionSchema,
  sessionScheduledEventDefinition,
  sessionUpdatedEventDefinition,
  sessionStartedEventDefinition,
  sessionCompletedEventDefinition,
  sessionCancelledEventDefinition,
  sessionNoShowEventDefinition,
  sessionReminder24hEventDefinition,
  sessionReminder1hEventDefinition,
  sessionReminder10mEventDefinition,
  createRatingSchema,
  ratingSchema,
  ratingSubmittedEventDefinition,
} from '../src';

describe('shared contracts', () => {
  it('accepts only the initial system roles', () => {
    expect(systemRoleSchema.parse('USER')).toBe('USER');
    expect(systemRoleSchema.parse('ADMIN')).toBe('ADMIN');
    expect(() => systemRoleSchema.parse('TEACHER')).toThrow();
    expect(() => systemRoleSchema.parse('STUDENT')).toThrow();
  });

  it('normalizes pagination input', () => {
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '10' })).toEqual({
      page: 2,
      pageSize: 10,
    });
  });

  it('rejects error responses without a request id', () => {
    expect(
      apiErrorResponseSchema.safeParse({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
      }).success,
    ).toBe(false);
  });

  it('keeps registration input strict and free of role fields', () => {
    const input = registerRequestSchema.parse({
      displayName: 'Ada Lovelace',
      email: ' ADA@example.test ',
      password: 'correct horse battery staple',
    });

    expect(input.email).toBe('ADA@example.test');
    expect(registerRequestSchema.safeParse({ ...input, role: 'ADMIN' }).success).toBe(false);
  });

  it('exposes only safe authentication identity fields', () => {
    const result = authUserSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'ada@example.test',
      displayName: 'Ada Lovelace',
      status: 'ACTIVE',
      roles: ['USER'],
      createdAt: '2026-09-24T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.success && 'passwordHash' in result.data).toBe(false);
    expect(
      authUserSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        email: 'ada@example.test',
        displayName: 'Ada Lovelace',
        status: 'ACTIVE',
        roles: ['USER'],
        createdAt: '2026-09-24T00:00:00.000Z',
        passwordHash: 'must-not-be-returned',
      }).success,
    ).toBe(false);
  });

  it('requires a versioned event envelope', () => {
    const result = eventEnvelopeSchema.safeParse({
      eventId: '00000000-0000-4000-8000-000000000001',
      eventType: 'FOUNDATION_TEST_EVENT',
      version: 1,
      occurredAt: '2026-09-24T00:00:00.000Z',
      actorId: null,
      entityType: 'Infrastructure',
      entityId: 'test',
      correlationId: null,
      causationId: null,
      idempotencyKey: 'test-event-1',
      payload: {},
    });

    expect(result.success).toBe(true);
  });

  it('normalizes profile defaults and keeps profile writes strict', () => {
    const result = createProfileRequestSchema.parse({ department: '  Computer Science  ' });

    expect(result).toMatchObject({
      department: 'Computer Science',
      interests: [],
      visibility: 'PUBLIC',
    });
    expect(createProfileRequestSchema.safeParse({ role: 'ADMIN' }).success).toBe(false);
    expect(updateProfileRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProfileRequestSchema.parse({ department: null })).toEqual({ department: null });
  });

  it('rejects unsafe profile URLs and control characters', () => {
    expect(
      createProfileRequestSchema.safeParse({ profileImageUrl: 'file:///tmp/avatar.png' }).success,
    ).toBe(false);
    expect(createProfileRequestSchema.safeParse({ githubUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(
      createProfileRequestSchema.safeParse({ portfolioUrl: 'https://user:password@example.test' })
        .success,
    ).toBe(false);
    expect(createProfileRequestSchema.safeParse({ department: `Math\u0000ematics` }).success).toBe(
      false,
    );
  });

  it('validates learning, availability, certification, and project foundations', () => {
    expect(
      createLearningGoalRequestSchema.safeParse({
        skillId: '00000000-0000-4000-8000-000000000001',
        targetLevel: 'ADVANCED',
      }).success,
    ).toBe(true);
    expect(
      createAvailabilityRequestSchema.safeParse({
        dayOfWeek: 'MONDAY',
        startTime: '18:00',
        endTime: '17:00',
      }).success,
    ).toBe(false);
    expect(
      createCertificationRequestSchema.safeParse({
        title: 'Certificate',
        issuingOrganization: 'Example Org',
        issueDate: '2026-02-01',
        expiryDate: '2026-01-01',
      }).success,
    ).toBe(false);
    expect(
      createProjectRequestSchema.safeParse({
        title: 'Project',
        description: 'A project',
        projectUrl: 'javascript:alert(1)',
        startDate: '2026-02-01',
        endDate: '2026-01-01',
      }).success,
    ).toBe(false);
  });

  it('validates discovery queries and keeps private fields out of results', () => {
    expect(discoveryUserQuerySchema.parse({ skill: 'Java', page: '2', limit: '10' })).toEqual({
      skill: 'Java',
      page: 2,
      limit: 10,
    });
    expect(discoveryUserQuerySchema.safeParse({ page: 1, limit: 10 }).success).toBe(false);
    expect(discoveryUserQuerySchema.safeParse({ skill: 'Java', limit: 101 }).success).toBe(false);
    expect(
      discoveryUserSchema.safeParse({
        userId: '00000000-0000-4000-8000-000000000001',
        displayName: 'Ada',
        profileImageUrl: null,
        department: null,
        institution: null,
        bio: null,
        skills: [],
        email: 'must-not@example.test',
      }).success,
    ).toBe(false);
  });

  it('validates matching queries and keeps exchange responses explicit', () => {
    expect(matchingQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(matchingQuerySchema.safeParse({ page: 1, limit: 101 }).success).toBe(false);
    expect(matchingQuerySchema.safeParse({ page: 1, limit: 20, unexpected: true }).success).toBe(
      false,
    );

    const skill = { id: '00000000-0000-4000-8000-000000000003', name: 'AWS' };
    expect(
      matchingUserSchema.safeParse({
        userId: '00000000-0000-4000-8000-000000000002',
        displayName: 'Candidate',
        relevantSkills: [skill],
        relevantLearningGoals: [],
        matchScore: 2,
        reasons: ['Can teach AWS, which you want to learn.'],
        mutual: false,
        email: 'must-not@example.test',
      }).success,
    ).toBe(false);
    expect(
      mutualExchangeSchema.safeParse({
        partnerUserId: '00000000-0000-4000-8000-000000000002',
        displayName: 'Candidate',
        exchangePairs: [{ skillYouCanTeach: skill, skillTheyCanTeach: { ...skill, name: 'C++' } }],
        explanation: 'Both users can teach a skill the other wants to learn.',
      }).success,
    ).toBe(true);
  });

  it('validates session request inputs, safe responses, and lifecycle events', () => {
    const requesterUserId = '00000000-0000-4000-8000-000000000001';
    const recipientUserId = '00000000-0000-4000-8000-000000000002';
    const requestId = '00000000-0000-4000-8000-000000000003';
    const skillId = '00000000-0000-4000-8000-000000000004';
    const timestamp = '2026-09-29T00:00:00.000Z';

    expect(
      createSessionRequestSchema.parse({ recipientUserId, skillId, message: 'Hello' }),
    ).toEqual({ recipientUserId, skillId, message: 'Hello' });
    expect(updateSessionRequestSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
    expect(
      sessionRequestSchema.safeParse({
        id: requestId,
        requester: { userId: requesterUserId, displayName: 'Requester' },
        recipient: { userId: recipientUserId, displayName: 'Recipient' },
        skill: { id: skillId, name: 'AWS' },
        message: 'Hello',
        status: 'PENDING',
        createdAt: timestamp,
        updatedAt: timestamp,
        email: 'must-not@example.test',
      }).success,
    ).toBe(false);
    for (const definition of [
      requestSentEventDefinition,
      requestAcceptedEventDefinition,
      requestDeclinedEventDefinition,
      requestCancelledEventDefinition,
    ]) {
      expect(
        definition.payloadSchema.safeParse({
          requestId,
          requesterUserId,
          recipientUserId,
          skillId,
          status: 'PENDING',
        }).success,
      ).toBe(true);
    }
  });

  it('validates Session scheduling inputs, safe responses, and event definitions', () => {
    const sessionRequestId = '00000000-0000-4000-8000-000000000001';
    const hostUserId = '00000000-0000-4000-8000-000000000002';
    const participantUserId = '00000000-0000-4000-8000-000000000003';
    const sessionId = '00000000-0000-4000-8000-000000000004';
    const skillId = '00000000-0000-4000-8000-000000000005';
    const timestamp = '2026-09-30T10:00:00.000Z';

    expect(
      createSessionSchema.safeParse({
        sessionRequestId,
        mode: 'ONLINE',
        scheduledStart: timestamp,
        scheduledEnd: '2026-09-30T11:00:00.000Z',
        timezone: 'UTC',
      }).success,
    ).toBe(true);
    expect(
      createSessionSchema.safeParse({
        sessionRequestId,
        mode: 'ONLINE',
        scheduledStart: timestamp,
        scheduledEnd: timestamp,
        timezone: 'UTC',
      }).success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        sessionRequestId,
        mode: 'OFFLINE',
        scheduledStart: timestamp,
        scheduledEnd: '2026-09-30T11:00:00.000Z',
        timezone: 'UTC',
      }).success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        sessionRequestId,
        mode: 'OFFLINE',
        scheduledStart: timestamp,
        scheduledEnd: '2026-09-30T11:00:00.000Z',
        timezone: 'UTC',
        locationDetails: 'MIT Campus Library',
      }).success,
    ).toBe(true);
    expect(
      createSessionSchema.safeParse({
        sessionRequestId,
        mode: 'ONLINE',
        scheduledStart: timestamp,
        scheduledEnd: '2026-09-30T11:00:00.000Z',
        timezone: 'Not/A_Timezone',
      }).success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({
        id: sessionId,
        sessionRequestId,
        host: { userId: hostUserId, displayName: 'Host' },
        participant: { userId: participantUserId, displayName: 'Participant' },
        skill: { id: skillId, name: 'AWS' },
        mode: 'ONLINE',
        status: 'SCHEDULED',
        scheduledStart: timestamp,
        scheduledEnd: '2026-09-30T11:00:00.000Z',
        timezone: 'UTC',
        meetingUrl: null,
        locationDetails: null,
        googleConferenceStatus: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        email: 'must-not@example.test',
      }).success,
    ).toBe(false);
    const payload = {
      sessionId,
      sessionRequestId,
      hostUserId,
      participantUserId,
      skillId,
      mode: 'ONLINE',
      status: 'SCHEDULED',
      scheduledStart: timestamp,
      scheduledEnd: '2026-09-30T11:00:00.000Z',
      timezone: 'UTC',
    };
    for (const definition of [
      sessionScheduledEventDefinition,
      sessionUpdatedEventDefinition,
      sessionStartedEventDefinition,
      sessionCompletedEventDefinition,
      sessionCancelledEventDefinition,
      sessionNoShowEventDefinition,
    ]) {
      expect(definition.payloadSchema.safeParse(payload).success).toBe(true);
    }
    const reminderPayload = {
      reminderId: '00000000-0000-4000-8000-000000000006',
      sessionId,
      reminderType: 'ONE_HOUR',
      scheduledFor: '2026-09-30T09:00:00.000Z',
    };
    for (const definition of [
      sessionReminder24hEventDefinition,
      sessionReminder1hEventDefinition,
      sessionReminder10mEventDefinition,
    ]) {
      expect(definition.payloadSchema.safeParse(reminderPayload).success).toBe(true);
    }
  });

  it('validates rating inputs, safe responses, and the submitted event', () => {
    const sessionId = '00000000-0000-4000-8000-000000000001';
    const raterUserId = '00000000-0000-4000-8000-000000000002';
    const ratedUserId = '00000000-0000-4000-8000-000000000003';
    const ratingId = '00000000-0000-4000-8000-000000000004';
    const timestamp = '2026-09-30T12:00:00.000Z';

    expect(
      createRatingSchema.parse({ sessionId, rating: 5, feedback: '  Helpful session.  ' }),
    ).toEqual({ sessionId, rating: 5, feedback: 'Helpful session.' });
    expect(createRatingSchema.safeParse({ sessionId, rating: 0 }).success).toBe(false);
    expect(createRatingSchema.safeParse({ sessionId, rating: 6 }).success).toBe(false);
    expect(
      ratingSchema.safeParse({
        id: ratingId,
        sessionId,
        rater: { userId: raterUserId, displayName: 'Rater' },
        ratedUser: { userId: ratedUserId, displayName: 'Rated partner' },
        rating: 4,
        feedback: 'Clear and helpful.',
        createdAt: timestamp,
        updatedAt: timestamp,
        email: 'must-not@example.test',
      }).success,
    ).toBe(false);
    expect(
      ratingSubmittedEventDefinition.payloadSchema.safeParse({
        ratingId,
        sessionId,
        raterUserId,
        ratedUserId,
        rating: 4,
      }).success,
    ).toBe(true);
  });

  it('keeps the profile response free of authentication fields', () => {
    const safeProfile = {
      id: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      displayName: 'Ada Lovelace',
      department: 'Computer Science',
      academicYear: null,
      institution: null,
      bio: null,
      profileImageUrl: null,
      interests: [],
      githubUrl: null,
      portfolioUrl: null,
      visibility: 'PUBLIC',
      createdAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z',
    };

    const result = profileResponseSchema.safeParse(safeProfile);
    expect(result.success).toBe(true);
    expect(result.success && 'email' in result.data).toBe(false);
    expect(
      profileResponseSchema.safeParse({ ...safeProfile, email: 'must-not@example.test' }).success,
    ).toBe(false);
    expect(profileUpdatedEventDefinition).toMatchObject({
      name: 'PROFILE_UPDATED',
      version: 1,
      ownerModule: 'users',
    });
  });
});
