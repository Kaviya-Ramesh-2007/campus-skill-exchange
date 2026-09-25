import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';
import { AssessmentsService } from '../src/modules/assessments/assessments.service';
import {
  DuplicateAssessmentError,
  type AssessmentRecord,
  type AssessmentSessionRecord,
  type AssessmentsRepository,
} from '../src/modules/assessments/assessments.types';
import type {
  AssessmentSubmittedEventPayload,
  AuthUser,
  CreateAssessment,
  EventEnvelope,
} from '@campus-skill-exchange/contracts';

const hostId = '00000000-0000-4000-8000-000000000001';
const participantId = '00000000-0000-4000-8000-000000000002';
const unrelatedId = '00000000-0000-4000-8000-000000000003';
const sessionId = '00000000-0000-4000-8000-000000000004';
const skillId = '00000000-0000-4000-8000-000000000005';
const now = new Date('2026-10-01T12:00:00.000Z');
const input: CreateAssessment = {
  sessionId,
  understandingScore: 5,
  practicalApplicationScore: 4,
  problemSolvingScore: 4,
  communicationScore: 5,
  reliabilityScore: 5,
  feedback: 'Clear and helpful.',
};
const actor: AuthUser = {
  id: hostId,
  email: 'host@example.test',
  displayName: 'Host',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: now.toISOString(),
};

class FakeAssessmentsRepository implements AssessmentsRepository {
  session: AssessmentSessionRecord = {
    id: sessionId,
    status: 'COMPLETED',
    hostUserId: hostId,
    participantUserId: participantId,
    skillId,
    host: { userId: hostId, displayName: 'Host' },
    participant: { userId: participantId, displayName: 'Partner' },
  };
  readonly events: EventEnvelope<AssessmentSubmittedEventPayload>[] = [];
  private readonly assessments: AssessmentRecord[] = [];

  async findSession(id: string) {
    return id === sessionId ? this.session : null;
  }
  async listForUser(userId: string) {
    return this.assessments.filter((assessment) => assessment.assessedUser.userId === userId);
  }
  async listForSession(id: string) {
    return this.assessments.filter((assessment) => assessment.sessionId === id);
  }
  async create(
    id: string,
    assessorUserId: string,
    data: CreateAssessment,
    event: EventEnvelope<AssessmentSubmittedEventPayload>,
  ) {
    const assessedUserId = assessorUserId === hostId ? participantId : hostId;
    if (
      this.assessments.some(
        (assessment) =>
          assessment.sessionId === data.sessionId && assessment.assessor.userId === assessorUserId,
      )
    ) {
      throw new DuplicateAssessmentError();
    }
    const row: AssessmentRecord = {
      id,
      sessionId: data.sessionId,
      assessor: { userId: assessorUserId, displayName: 'Assessor' },
      assessedUser: { userId: assessedUserId, displayName: 'Assessed' },
      skill: data.skillId || skillId ? { id: skillId, name: 'TypeScript' } : null,
      understandingScore: data.understandingScore,
      practicalApplicationScore: data.practicalApplicationScore,
      problemSolvingScore: data.problemSolvingScore,
      communicationScore: data.communicationScore,
      reliabilityScore: data.reliabilityScore,
      feedback: data.feedback ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.assessments.push(row);
    this.events.push(event);
    return row;
  }
}

function setup() {
  const repository = new FakeAssessmentsRepository();
  const service = new AssessmentsService(repository, new SystemRoleAuthorizationPolicy());
  return { repository, service };
}

describe('AssessmentsService', () => {
  it('creates a valid assessment and emits ASSESSMENT_SUBMITTED', async () => {
    const { repository, service } = setup();
    const result = await service.create(hostId, input);

    expect(result).toMatchObject({
      sessionId,
      assessor: { userId: hostId },
      assessedUser: { userId: participantId },
      understandingScore: 5,
    });
    expect(repository.events[0]).toMatchObject({
      eventType: 'ASSESSMENT_SUBMITTED',
      actorId: hostId,
      payload: { sessionId, assessedUserId: participantId },
    });
  });

  it('requires a completed session and participant authorization', async () => {
    const { repository, service } = setup();
    await expect(service.create(unrelatedId, input)).rejects.toBeInstanceOf(ApiException);
    repository.session.status = 'SCHEDULED';
    await expect(service.create(hostId, input)).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects self-assessment and invalid scores', async () => {
    const { repository, service } = setup();
    repository.session.participantUserId = hostId;
    await expect(service.create(hostId, input)).rejects.toBeInstanceOf(ApiException);
    await expect(
      service.create(hostId, { ...input, understandingScore: 0 }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects duplicate assessments and returns session assessments', async () => {
    const { service } = setup();
    await service.create(hostId, input);
    await expect(service.create(hostId, input)).rejects.toBeInstanceOf(ApiException);
    await expect(service.listForSession(actor, sessionId)).resolves.toHaveLength(1);
  });
});
