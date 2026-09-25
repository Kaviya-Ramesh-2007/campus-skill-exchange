import type {
  Assessment,
  AssessmentSubmittedEventPayload,
  CreateAssessment,
  EventEnvelope,
} from '@campus-skill-exchange/contracts';

export const ASSESSMENTS_REPOSITORY = Symbol('ASSESSMENTS_REPOSITORY');

export type AssessmentIdentity = Pick<Assessment['assessor'], 'userId' | 'displayName'>;
export type AssessmentSkill = NonNullable<Assessment['skill']>;
export type AssessmentSessionStatus =
  'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface AssessmentSessionRecord {
  id: string;
  status: AssessmentSessionStatus;
  hostUserId: string;
  participantUserId: string;
  skillId: string | null;
  host: AssessmentIdentity;
  participant: AssessmentIdentity;
}

export interface AssessmentRecord {
  id: string;
  sessionId: string;
  assessor: AssessmentIdentity;
  assessedUser: AssessmentIdentity;
  skill: AssessmentSkill | null;
  understandingScore: number;
  practicalApplicationScore: number;
  problemSolvingScore: number;
  communicationScore: number;
  reliabilityScore: number;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssessmentsRepository {
  findSession(sessionId: string): Promise<AssessmentSessionRecord | null>;
  listForUser(userId: string): Promise<AssessmentRecord[]>;
  listForSession(sessionId: string): Promise<AssessmentRecord[]>;
  create(
    id: string,
    assessorUserId: string,
    input: CreateAssessment,
    event: EventEnvelope<AssessmentSubmittedEventPayload>,
  ): Promise<AssessmentRecord>;
}

export class AssessmentNotFoundError extends Error {
  constructor() {
    super('The assessment session was not found.');
    this.name = 'AssessmentNotFoundError';
  }
}

export class AssessmentNotEligibleError extends Error {
  constructor() {
    super('Only completed Sessions can be assessed.');
    this.name = 'AssessmentNotEligibleError';
  }
}

export class AssessmentParticipantError extends Error {
  constructor() {
    super('Only Session participants can access or submit assessments.');
    this.name = 'AssessmentParticipantError';
  }
}

export class AssessmentSelfError extends Error {
  constructor() {
    super('A User cannot assess themselves.');
    this.name = 'AssessmentSelfError';
  }
}

export class DuplicateAssessmentError extends Error {
  constructor() {
    super('An assessment already exists for this Session and assessor.');
    this.name = 'DuplicateAssessmentError';
  }
}

export class AssessmentSkillMismatchError extends Error {
  constructor() {
    super('The assessment skill must match the Session skill.');
    this.name = 'AssessmentSkillMismatchError';
  }
}
