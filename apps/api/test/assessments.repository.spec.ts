import { describe, expect, it, vi } from 'vitest';
import { PrismaAssessmentsRepository } from '../src/modules/assessments/prisma-assessments.repository';
import {
  AssessmentNotEligibleError,
  DuplicateAssessmentError,
} from '../src/modules/assessments/assessments.types';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type {
  AssessmentSubmittedEventPayload,
  EventEnvelope,
} from '@campus-skill-exchange/contracts';

const sessionId = '00000000-0000-4000-8000-000000000001';
const assessorId = '00000000-0000-4000-8000-000000000002';
const assessedId = '00000000-0000-4000-8000-000000000003';
const assessmentId = '00000000-0000-4000-8000-000000000004';
const now = new Date('2026-10-01T12:00:00.000Z');
const event: EventEnvelope<AssessmentSubmittedEventPayload> = {
  eventId: '00000000-0000-4000-8000-000000000005',
  eventType: 'ASSESSMENT_SUBMITTED',
  version: 1,
  occurredAt: now.toISOString(),
  actorId: assessorId,
  entityType: 'Assessment',
  entityId: assessmentId,
  correlationId: null,
  causationId: null,
  idempotencyKey: `assessment-submitted:${assessmentId}`,
  payload: {
    assessmentId,
    sessionId,
    assessorUserId: assessorId,
    assessedUserId: assessedId,
    skillId: null,
  },
};
const row = {
  id: assessmentId,
  sessionId,
  assessorUserId: assessorId,
  assessedUserId: assessedId,
  skillId: null,
  understandingScore: 5,
  practicalApplicationScore: 4,
  problemSolvingScore: 4,
  communicationScore: 5,
  reliabilityScore: 5,
  feedback: null,
  createdAt: now,
  updatedAt: now,
  assessor: { id: assessorId, displayName: 'Assessor', profile: null },
  assessedUser: { id: assessedId, displayName: 'Assessed', profile: null },
  skill: null,
};
const input = {
  sessionId,
  understandingScore: 5,
  practicalApplicationScore: 4,
  problemSolvingScore: 4,
  communicationScore: 5,
  reliabilityScore: 5,
};

function setup() {
  const tx = {
    learningSession: {
      findUnique: vi.fn().mockResolvedValue({
        id: sessionId,
        status: 'COMPLETED',
        hostUserId: assessorId,
        participantUserId: assessedId,
        skillId: null,
      }),
    },
    assessment: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(row),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const repository = new PrismaAssessmentsRepository(prisma, outbox);
  return { repository, tx, outbox };
}

describe('PrismaAssessmentsRepository', () => {
  it('writes an assessment and event transactionally', async () => {
    const { repository, tx, outbox } = setup();
    await repository.create(assessmentId, assessorId, input, event);

    expect(tx.assessment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assessedUserId: assessedId }) }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(event, tx);
  });

  it('rejects non-completed sessions and duplicate assessments', async () => {
    const { repository, tx } = setup();
    tx.learningSession.findUnique.mockResolvedValueOnce({
      id: sessionId,
      status: 'SCHEDULED',
      hostUserId: assessorId,
      participantUserId: assessedId,
      skillId: null,
    });
    await expect(repository.create(assessmentId, assessorId, input, event)).rejects.toBeInstanceOf(
      AssessmentNotEligibleError,
    );

    tx.learningSession.findUnique.mockResolvedValueOnce({
      id: sessionId,
      status: 'COMPLETED',
      hostUserId: assessorId,
      participantUserId: assessedId,
      skillId: null,
    });
    tx.assessment.findUnique.mockResolvedValueOnce({ id: assessmentId });
    await expect(repository.create(assessmentId, assessorId, input, event)).rejects.toBeInstanceOf(
      DuplicateAssessmentError,
    );
  });
});
