import type {
  CreateSession,
  EventEnvelope,
  Session,
  SessionEventPayload,
  SessionMode,
  SessionStatus,
} from '@campus-skill-exchange/contracts';

export const SESSIONS_REPOSITORY = Symbol('SESSIONS_REPOSITORY');

export type SessionIdentity = Pick<Session['host'], 'userId' | 'displayName'>;
export type SessionSkill = NonNullable<Session['skill']>;

export interface SessionRecord {
  id: string;
  sessionRequestId: string;
  host: SessionIdentity;
  participant: SessionIdentity;
  skill: SessionSkill | null;
  mode: SessionMode;
  status: SessionStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  timezone: string;
  meetingUrl: string | null;
  locationDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRequestRecord {
  requesterUserId: string;
  recipientUserId: string;
  skillId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
}

export interface SessionListResult {
  items: SessionRecord[];
  total: number;
}

export interface SessionsRepository {
  findRequest(requestId: string): Promise<SessionRequestRecord | null>;
  findById(id: string): Promise<SessionRecord | null>;
  list(userId: string, page: number, limit: number): Promise<SessionListResult>;
  create(
    id: string,
    actorUserId: string,
    input: CreateSession,
    event: EventEnvelope<SessionEventPayload>,
  ): Promise<SessionRecord>;
  updateStatus(
    id: string,
    fromStatus: SessionStatus,
    toStatus: SessionStatus,
    events: EventEnvelope<SessionEventPayload>[],
  ): Promise<SessionRecord | null>;
}

export class SessionRequestNotAcceptedError extends Error {
  constructor() {
    super('Only an accepted SessionRequest can create a Session.');
    this.name = 'SessionRequestNotAcceptedError';
  }
}

export class SessionParticipantError extends Error {
  constructor() {
    super('Only a SessionRequest participant can create a Session.');
    this.name = 'SessionParticipantError';
  }
}

export class DuplicateSessionError extends Error {
  constructor() {
    super('A Session already exists for this SessionRequest.');
    this.name = 'DuplicateSessionError';
  }
}
