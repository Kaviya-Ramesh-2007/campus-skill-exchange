import type {
  CreateSessionRequest,
  EventEnvelope,
  SessionRequest,
  SessionRequestEventPayload,
  SessionRequestStatus,
} from '@campus-skill-exchange/contracts';

export const REQUESTS_REPOSITORY = Symbol('REQUESTS_REPOSITORY');

export type SessionRequestIdentity = Pick<SessionRequest['requester'], 'userId' | 'displayName'>;
export type SessionRequestSkill = NonNullable<SessionRequest['skill']>;

export interface SessionRequestRecord {
  id: string;
  requester: SessionRequestIdentity;
  recipient: SessionRequestIdentity;
  skill: SessionRequestSkill | null;
  message: string | null;
  status: SessionRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRequestListResult {
  items: SessionRequestRecord[];
  total: number;
}

export interface RequestsRepository {
  findById(id: string): Promise<SessionRequestRecord | null>;
  list(userId: string, page: number, limit: number): Promise<SessionRequestListResult>;
  create(
    id: string,
    requesterUserId: string,
    input: CreateSessionRequest,
    event: EventEnvelope<SessionRequestEventPayload>,
  ): Promise<SessionRequestRecord>;
  updateStatus(
    id: string,
    status: Exclude<SessionRequestStatus, 'PENDING'>,
    event: EventEnvelope<SessionRequestEventPayload>,
  ): Promise<SessionRequestRecord | null>;
}

export class DuplicateSessionRequestError extends Error {
  constructor() {
    super('An active request already exists.');
    this.name = 'DuplicateSessionRequestError';
  }
}

export class RequestRecipientNotFoundError extends Error {
  constructor() {
    super('The recipient is not an active User.');
    this.name = 'RequestRecipientNotFoundError';
  }
}

export class RequestSkillNotFoundError extends Error {
  constructor() {
    super('The requested Skill does not exist.');
    this.name = 'RequestSkillNotFoundError';
  }
}
