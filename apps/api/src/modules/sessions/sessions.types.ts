import type {
  CreateSession,
  EventEnvelope,
  Session,
  SessionEventPayload,
  SessionMode,
  SessionStatus,
  UpdateSession,
} from '@campus-skill-exchange/contracts';

export const SESSIONS_REPOSITORY = Symbol('SESSIONS_REPOSITORY');

export type SessionIdentity = Pick<Session['host'], 'userId' | 'displayName'>;
export type SessionSkill = NonNullable<Session['skill']>;

export interface SessionGoogleData {
  eventId: string;
  conferenceId: string | null;
  meetingUrl: string | null;
  conferenceStatus: 'PENDING' | 'READY' | 'FAILED';
}

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
  googleCalendarEventId: string | null;
  googleConferenceId: string | null;
  googleConferenceStatus: 'PENDING' | 'READY' | 'FAILED' | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRequestRecord {
  requesterUserId: string;
  recipientUserId: string;
  skillId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
}

export interface SessionParticipantDirectory {
  userId: string;
  email: string;
  displayName: string;
}

export interface SessionListResult {
  items: SessionRecord[];
  total: number;
}

export type SessionUpdate = {
  status?: UpdateSession['status'];
  locationDetails?: string | null;
  meetingUrl?: string | null;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  timezone?: string;
};

export interface SessionsRepository {
  findRequest(requestId: string): Promise<SessionRequestRecord | null>;
  findParticipantEmails?: (userIds: string[]) => Promise<SessionParticipantDirectory[]>;
  findById(id: string): Promise<SessionRecord | null>;
  list(userId: string, page: number, limit: number): Promise<SessionListResult>;
  create(
    id: string,
    actorUserId: string,
    input: CreateSession,
    event: EventEnvelope<SessionEventPayload>,
    googleData?: SessionGoogleData | null,
  ): Promise<SessionRecord>;
  update(
    id: string,
    fromStatus: SessionStatus,
    update: SessionUpdate,
    events: EventEnvelope<SessionEventPayload>[],
    scheduleChanged: boolean,
    googleData?: SessionGoogleData | null,
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
