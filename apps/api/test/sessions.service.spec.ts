import { describe, expect, it } from 'vitest';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { reminderTimesFor } from '../src/modules/sessions/session-reminders';
import type { GoogleIntegrationService } from '../src/modules/integrations/google/google-integration.service';
import {
  DuplicateSessionError,
  SessionParticipantError,
  SessionRequestNotAcceptedError,
  type SessionListResult,
  type SessionRecord,
  type SessionRequestRecord,
  type SessionsRepository,
} from '../src/modules/sessions/sessions.types';
import type {
  CreateSession,
  EventEnvelope,
  SessionEventPayload,
  SessionStatus,
} from '@campus-skill-exchange/contracts';

const requestId = '00000000-0000-4000-8000-000000000001';
const hostId = '00000000-0000-4000-8000-000000000002';
const participantId = '00000000-0000-4000-8000-000000000003';
const unrelatedId = '00000000-0000-4000-8000-000000000004';
const skillId = '00000000-0000-4000-8000-000000000006';
const start = '2026-09-30T10:00:00.000Z';
const end = '2026-09-30T11:00:00.000Z';
const now = new Date('2026-09-29T00:00:00.000Z');

const input: CreateSession = {
  sessionRequestId: requestId,
  mode: 'ONLINE',
  scheduledStart: start,
  scheduledEnd: end,
  timezone: 'UTC',
};

class FakeSessionsRepository implements SessionsRepository {
  request: SessionRequestRecord = {
    requesterUserId: hostId,
    recipientUserId: participantId,
    skillId,
    status: 'ACCEPTED',
  };
  readonly events: EventEnvelope<SessionEventPayload>[] = [];
  private readonly sessions = new Map<string, SessionRecord>();

  async findRequest(id: string): Promise<SessionRequestRecord | null> {
    return id === requestId ? this.request : null;
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return this.sessions.get(id) ?? null;
  }

  async list(userId: string, page: number, limit: number): Promise<SessionListResult> {
    const items = [...this.sessions.values()].filter(
      (item) => item.host.userId === userId || item.participant.userId === userId,
    );
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length };
  }

  async create(
    id: string,
    actorUserId: string,
    data: CreateSession,
    event: EventEnvelope<SessionEventPayload>,
    googleData?: {
      eventId: string;
      conferenceId: string | null;
      meetingUrl: string | null;
      conferenceStatus: 'PENDING' | 'READY' | 'FAILED';
    } | null,
  ): Promise<SessionRecord> {
    if (this.request.status !== 'ACCEPTED') throw new SessionRequestNotAcceptedError();
    if (
      actorUserId !== this.request.requesterUserId &&
      actorUserId !== this.request.recipientUserId
    ) {
      throw new SessionParticipantError();
    }
    if (
      [...this.sessions.values()].some((item) => item.sessionRequestId === data.sessionRequestId)
    ) {
      throw new DuplicateSessionError();
    }
    const row: SessionRecord = {
      id,
      sessionRequestId: data.sessionRequestId,
      host: { userId: this.request.requesterUserId, displayName: 'Host' },
      participant: { userId: this.request.recipientUserId, displayName: 'Participant' },
      skill: this.request.skillId ? { id: this.request.skillId, name: 'AWS' } : null,
      mode: data.mode,
      status: 'SCHEDULED',
      scheduledStart: new Date(data.scheduledStart),
      scheduledEnd: new Date(data.scheduledEnd),
      timezone: data.timezone,
      meetingUrl: data.meetingUrl ?? null,
      locationDetails: data.locationDetails ?? null,
      googleCalendarEventId: googleData?.eventId ?? null,
      googleConferenceId: googleData?.conferenceId ?? null,
      googleConferenceStatus: googleData?.conferenceStatus ?? null,
      paymentMode: data.paymentMode ?? 'FREE',
      pricePaise: data.paymentMode === 'PAID' ? (data.pricePaise ?? null) : null,
      termsVersion: data.paymentMode === 'PAID' ? 'test-terms-v1' : null,
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, row);
    this.events.push(event);
    return row;
  }

  async update(
    id: string,
    fromStatus: SessionStatus,
    update: {
      status?: SessionStatus;
      locationDetails?: string | null;
      meetingUrl?: string | null;
      scheduledStart?: Date;
      scheduledEnd?: Date;
      timezone?: string;
    },
    events: EventEnvelope<SessionEventPayload>[],
    _scheduleChanged: boolean,
    googleData?: {
      eventId: string;
      conferenceId: string | null;
      meetingUrl: string | null;
      conferenceStatus: 'PENDING' | 'READY' | 'FAILED';
    } | null,
  ): Promise<SessionRecord | null> {
    const row = this.sessions.get(id);
    if (!row || row.status !== fromStatus) return null;
    const updated = {
      ...row,
      ...update,
      status: update.status ?? row.status,
      ...(googleData === undefined
        ? {}
        : googleData === null
          ? {
              googleCalendarEventId: null,
              googleConferenceId: null,
              googleConferenceStatus: null,
              meetingUrl: null,
            }
          : {
              googleCalendarEventId: googleData.eventId,
              googleConferenceId: googleData.conferenceId,
              googleConferenceStatus: googleData.conferenceStatus,
              meetingUrl: googleData.meetingUrl,
            }),
      updatedAt: new Date(),
    };
    this.sessions.set(id, updated);
    this.events.push(...events);
    return updated;
  }
}

function serviceWithRepository() {
  const repository = new FakeSessionsRepository();
  const google = {
    createEvent: async () => ({
      eventId: 'google-event-1',
      conferenceId: 'conference-1',
      meetingUrl: 'https://meet.example.test/conference-1',
      conferenceStatus: 'READY' as const,
    }),
    updateEvent: async () => ({
      eventId: 'google-event-1',
      conferenceId: 'conference-1',
      meetingUrl: 'https://meet.example.test/conference-1',
      conferenceStatus: 'READY' as const,
    }),
    deleteEvent: async () => undefined,
  } as unknown as GoogleIntegrationService;
  return { repository, service: new SessionsService(repository, google) };
}

describe('SessionsService', () => {
  it('requires an accepted request and creates a scheduled session', async () => {
    const { repository, service } = serviceWithRepository();
    repository.request.status = 'PENDING';
    await expect(service.create(hostId, input)).rejects.toThrow();

    repository.request.status = 'ACCEPTED';
    const result = await service.create(hostId, input);
    expect(result).toMatchObject({
      host: { userId: hostId },
      participant: { userId: participantId },
      status: 'SCHEDULED',
    });
    expect(repository.events[0]).toMatchObject({ eventType: 'SESSION_SCHEDULED' });
  });

  it('rejects self-sessions and duplicate sessions', async () => {
    const { repository, service } = serviceWithRepository();
    repository.request = { ...repository.request, recipientUserId: hostId };
    await expect(service.create(hostId, input)).rejects.toThrow();

    repository.request = { ...repository.request, recipientUserId: participantId };
    await service.create(hostId, input);
    await expect(service.create(participantId, input)).rejects.toThrow();
  });

  it('rejects invalid times and timezones', async () => {
    const { service } = serviceWithRepository();
    await expect(service.create(hostId, { ...input, scheduledEnd: start })).rejects.toThrow();
    await expect(
      service.create(hostId, { ...input, timezone: 'Not/A_Timezone' }),
    ).rejects.toThrow();
  });

  it('restricts viewing and updates to participants', async () => {
    const { service } = serviceWithRepository();
    const created = await service.create(hostId, input);
    await expect(service.get(created.id, unrelatedId)).rejects.toThrow();
    await expect(
      service.update(created.id, unrelatedId, { status: 'IN_PROGRESS' }),
    ).rejects.toThrow();
    await expect(service.get(created.id, participantId)).resolves.toMatchObject({ id: created.id });
  });

  it('protects offline location details with participant authorization', async () => {
    const { service } = serviceWithRepository();
    const created = await service.create(hostId, {
      ...input,
      mode: 'OFFLINE',
      locationDetails: 'MIT Campus Library',
    });
    await expect(
      service.update(created.id, unrelatedId, { locationDetails: 'Elsewhere' }),
    ).rejects.toThrow();
    const updated = await service.update(created.id, participantId, {
      locationDetails: 'MIT Campus Library, Room 4',
    });
    expect(updated.locationDetails).toBe('MIT Campus Library, Room 4');
  });

  it('rejects invalid transitions and emits lifecycle events for valid ones', async () => {
    const { repository, service } = serviceWithRepository();
    const created = await service.create(hostId, input);
    await expect(service.update(created.id, hostId, { status: 'COMPLETED' })).rejects.toThrow();

    await service.update(created.id, hostId, { status: 'IN_PROGRESS' });
    expect(repository.events.at(-2)?.eventType).toBe('SESSION_UPDATED');
    expect(repository.events.at(-1)?.eventType).toBe('SESSION_STARTED');
    await service.update(created.id, participantId, { status: 'COMPLETED' });
    expect(repository.events.at(-1)?.eventType).toBe('SESSION_COMPLETED');
  });

  it('requires agreed location details for offline sessions and does not create meeting data', async () => {
    const { service } = serviceWithRepository();
    await expect(service.create(hostId, { ...input, mode: 'OFFLINE' })).rejects.toThrow();
    const offline = await service.create(hostId, {
      ...input,
      mode: 'OFFLINE',
      locationDetails: 'MIT Campus Library',
    });
    expect(offline.locationDetails).toBe('MIT Campus Library');
    expect(offline.meetingUrl).toBeNull();
  });

  it('allows online sessions without location details', async () => {
    const { service } = serviceWithRepository();
    const online = await service.create(hostId, input);
    expect(online.mode).toBe('ONLINE');
    expect(online.locationDetails).toBeNull();
  });

  it('calculates the three reminder times from the scheduled start', () => {
    const times = reminderTimesFor(new Date(start));
    expect(times.TWENTY_FOUR_HOURS.toISOString()).toBe('2026-09-29T10:00:00.000Z');
    expect(times.ONE_HOUR.toISOString()).toBe('2026-09-30T09:00:00.000Z');
    expect(times.TEN_MINUTES.toISOString()).toBe('2026-09-30T09:50:00.000Z');
  });

  it('lists only sessions involving the current User', async () => {
    const { service } = serviceWithRepository();
    const created = await service.create(hostId, input);
    const result = await service.list(participantId, {});
    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(created.id);
  });
});
