import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import type {
  GoogleApi,
  GoogleAuthorization,
  GoogleEventData,
  GoogleEventInput,
  GoogleTokenSet,
} from './google.types';

@Injectable()
export class GoogleApiClient implements GoogleApi {
  private readonly oauth2;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.oauth2 = new google.auth.OAuth2(
      config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
    );
  }

  createAuthorizationUrl(state: string): string {
    return this.oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state,
    });
  }

  async exchangeCode(code: string): Promise<GoogleTokenSet> {
    const { tokens } = await this.oauth2.getToken(code);
    if (!tokens.access_token) throw new Error('Google did not return an access token.');
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? '',
    };
  }

  async revokeAccessToken(accessToken: string): Promise<void> {
    await this.oauth2.revokeToken(accessToken);
  }

  async createEvent(
    authorization: GoogleAuthorization,
    input: GoogleEventInput,
  ): Promise<GoogleEventData> {
    const calendar = this.calendar(authorization);
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'none',
      requestBody: this.eventBody(input, true),
    });
    return this.eventData(response.data, null);
  }

  async updateEvent(
    authorization: GoogleAuthorization,
    eventId: string,
    input: GoogleEventInput,
    existing: GoogleEventData | null,
  ): Promise<GoogleEventData> {
    const calendar = this.calendar(authorization);
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'none',
      requestBody: this.eventBody(input, false),
    });
    return this.eventData(response.data, existing);
  }

  async deleteEvent(authorization: GoogleAuthorization, eventId: string): Promise<void> {
    try {
      await this.calendar(authorization).events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates: 'none',
      });
    } catch (error) {
      if (!this.isNotFound(error)) throw error;
    }
  }

  private calendar(authorization: GoogleAuthorization) {
    const auth = this.oauth2;
    auth.setCredentials({
      access_token: authorization.accessToken,
      refresh_token: authorization.refreshToken ?? undefined,
      expiry_date: authorization.expiresAt?.getTime(),
    });
    return google.calendar({ version: 'v3', auth });
  }

  private eventBody(input: GoogleEventInput, includeConference: boolean): calendar_v3.Schema$Event {
    return {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString(), timeZone: input.timezone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timezone },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      ...(includeConference
        ? {
            conferenceData: {
              createRequest: {
                requestId: `cse-session-${input.sessionId}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          }
        : {}),
    };
  }

  private eventData(
    event: calendar_v3.Schema$Event,
    existing: GoogleEventData | null,
  ): GoogleEventData {
    if (event.conferenceData?.createRequest?.status?.statusCode === 'failure') {
      throw new Error('Google conference creation failed.');
    }
    const entry =
      event.conferenceData?.entryPoints?.find((point) => point.entryPointType === 'video') ??
      event.conferenceData?.entryPoints?.[0];
    const meetingUrl = event.hangoutLink ?? entry?.uri ?? existing?.meetingUrl ?? null;
    const conferenceId = event.conferenceData?.conferenceId ?? existing?.conferenceId ?? null;
    if (!event.id) throw new Error('Google did not return a Calendar event ID.');
    return {
      eventId: event.id,
      conferenceId,
      meetingUrl,
      conferenceStatus: meetingUrl ? 'READY' : 'PENDING',
    };
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 404 || error.code === '404')
    );
  }
}
