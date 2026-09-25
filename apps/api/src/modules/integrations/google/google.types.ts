export const GOOGLE_API = Symbol('GOOGLE_API');

export interface GoogleTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date | null;
  scope: string;
}

export interface GoogleAuthorization {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

export interface GoogleEventInput {
  sessionId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone: string;
  attendeeEmails: string[];
}

export interface GoogleEventData {
  eventId: string;
  conferenceId: string | null;
  meetingUrl: string | null;
  conferenceStatus: 'PENDING' | 'READY' | 'FAILED';
}

export interface GoogleApi {
  createAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<GoogleTokenSet>;
  revokeAccessToken(accessToken: string): Promise<void>;
  createEvent(
    authorization: GoogleAuthorization,
    input: GoogleEventInput,
  ): Promise<GoogleEventData>;
  updateEvent(
    authorization: GoogleAuthorization,
    eventId: string,
    input: GoogleEventInput,
    existing: GoogleEventData | null,
  ): Promise<GoogleEventData>;
  deleteEvent(authorization: GoogleAuthorization, eventId: string): Promise<void>;
}
