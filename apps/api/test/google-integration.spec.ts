import { describe, expect, it, vi } from 'vitest';
import { GoogleIntegrationService } from '../src/modules/integrations/google/google-integration.service';
import { GoogleOAuthStateService } from '../src/modules/integrations/google/google-oauth-state.service';
import type { GoogleApi } from '../src/modules/integrations/google/google.types';
import type { PrismaService } from '../src/platform/database/prisma.service';

const userId = '00000000-0000-4000-8000-000000000001';
const eventInput = {
  sessionId: '00000000-0000-4000-8000-000000000002',
  summary: 'Session',
  start: new Date('2026-09-30T10:00:00.000Z'),
  end: new Date('2026-09-30T11:00:00.000Z'),
  timezone: 'UTC',
  attendeeEmails: ['host@example.test', 'participant@example.test'],
};

function serviceWith(overrides: Record<string, unknown> = {}) {
  const api = {
    createAuthorizationUrl: vi.fn().mockReturnValue('https://accounts.google.test/o/oauth2/auth'),
    exchangeCode: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-09-30T10:00:00.000Z'),
      scope: 'calendar.events',
    }),
    revokeAccessToken: vi.fn().mockResolvedValue(undefined),
    createEvent: vi.fn().mockResolvedValue({
      eventId: 'google-event',
      conferenceId: 'conference-id',
      meetingUrl: 'https://meet.example.test/conference-id',
      conferenceStatus: 'READY',
    }),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as GoogleApi;
  const prisma = {
    googleConnection: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as PrismaService;
  const config = {
    get: vi.fn(
      (key: string) =>
        ({
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/v1/integrations/google/callback',
          NODE_ENV: 'test',
        })[key],
    ),
    getOrThrow: vi.fn(
      (key: string) =>
        ({
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/v1/integrations/google/callback',
        })[key],
    ),
  };
  return {
    api,
    prisma,
    service: new GoogleIntegrationService(api, prisma, config as never),
  };
}

describe('Google OAuth and Calendar boundary', () => {
  it('validates OAuth state against the HttpOnly state cookie', () => {
    const setCookie = vi.fn();
    const clearCookie = vi.fn();
    const state = new GoogleOAuthStateService({
      get: vi.fn().mockReturnValue('test'),
    } as never);
    const reply = { setCookie, clearCookie } as never;
    const stateValue = state.issue(reply);
    const cookieName = setCookie.mock.calls[0]?.[0] as string;
    const request = { cookies: { [cookieName]: stateValue } };

    expect(() => state.assertValid(stateValue, request as never)).not.toThrow();
    expect(() => state.assertValid('wrong-state', request as never)).toThrow();
    state.clear(reply);
    expect(clearCookie).toHaveBeenCalled();
  });

  it('reports disconnected status and never returns tokens', async () => {
    const { service } = serviceWith();
    await expect(service.status(userId)).resolves.toEqual({
      connected: false,
      scopes: [],
      expiresAt: null,
    });
  });

  it('creates an authorization URL and persists exchanged tokens server-side', async () => {
    const { service, api, prisma } = serviceWith();
    await expect(service.getAuthorizationUrl('state-value')).resolves.toContain('google.test');
    await service.completeAuthorization(userId, 'auth-code');
    expect(api.exchangeCode).toHaveBeenCalledWith('auth-code');
    expect(prisma.googleConnection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }),
      }),
    );
  });

  it('rejects online event creation without a Google connection', async () => {
    const { service } = serviceWith();
    await expect(service.createEvent(userId, eventInput)).rejects.toThrow(
      'Connect Google Calendar before using Google Meet for an online Session.',
    );
  });

  it('passes the Calendar/Meet request and returns the URL from Google', async () => {
    const { service, prisma, api } = serviceWith();
    vi.mocked(prisma.googleConnection.findUnique).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: new Date('2026-09-30T10:00:00.000Z'),
      scope: 'calendar.events',
    } as never);
    const result = await service.createEvent(userId, eventInput);
    expect(api.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
      expect.objectContaining({
        sessionId: eventInput.sessionId,
        attendeeEmails: eventInput.attendeeEmails,
      }),
    );
    expect(result.meetingUrl).toBe('https://meet.example.test/conference-id');
    expect(result.conferenceStatus).toBe('READY');
  });

  it('maps Google API failures to a dependency error without a fake URL', async () => {
    const { service, prisma } = serviceWith({
      createEvent: vi.fn().mockRejectedValue(new Error('Google unavailable')),
    });
    vi.mocked(prisma.googleConnection.findUnique).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: null,
      accessTokenExpiresAt: null,
      scope: 'calendar.events',
    } as never);
    await expect(service.createEvent(userId, eventInput)).rejects.toMatchObject({
      status: 503,
    });
  });
});
