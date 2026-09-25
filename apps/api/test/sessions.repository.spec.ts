import { describe, expect, it, vi } from 'vitest';
import { PrismaSessionsRepository } from '../src/modules/sessions/prisma-sessions.repository';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type {
  CreateSession,
  EventEnvelope,
  SessionEventPayload,
} from '@campus-skill-exchange/contracts';

const requestId = '00000000-0000-4000-8000-000000000001';
const hostId = '00000000-0000-4000-8000-000000000002';
const participantId = '00000000-0000-4000-8000-000000000003';
const sessionId = '00000000-0000-4000-8000-000000000004';
const start = new Date('2026-09-30T10:00:00.000Z');
const end = new Date('2026-09-30T11:00:00.000Z');
const now = new Date('2026-09-29T00:00:00.000Z');
const input: CreateSession = {
  sessionRequestId: requestId,
  mode: 'ONLINE',
  scheduledStart: start.toISOString(),
  scheduledEnd: end.toISOString(),
  timezone: 'UTC',
};
const sessionEvent = {} as EventEnvelope<SessionEventPayload>;

const sessionRow = {
  id: sessionId,
  sessionRequestId: requestId,
  host: { id: hostId, displayName: 'Host', profile: null },
  participant: { id: participantId, displayName: 'Participant', profile: null },
  skill: null,
  mode: 'ONLINE',
  status: 'SCHEDULED',
  scheduledStart: start,
  scheduledEnd: end,
  timezone: 'UTC',
  meetingUrl: null,
  locationDetails: null,
  createdAt: now,
  updatedAt: now,
};

function setup() {
  const tx = {
    sessionRequest: {
      findUnique: vi.fn().mockResolvedValue({
        requesterUserId: hostId,
        recipientUserId: participantId,
        skillId: null,
        status: 'ACCEPTED',
      }),
    },
    learningSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(sessionRow),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    sessionReminder: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        status: 'PENDING',
        sentAt: null,
        createdAt: now,
        updatedAt: now,
      })),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: '00000000-0000-4000-8000-000000000005',
        sessionId: requestId,
        reminderType: 'ONE_HOUR',
        ...data,
      })),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const repository = new PrismaSessionsRepository(prisma, outbox);
  return { repository, tx, outbox };
}

describe('PrismaSessionsRepository reminders', () => {
  it('creates one reminder per type and emits reminder events', async () => {
    const { repository, tx, outbox } = setup();
    await repository.create(sessionId, hostId, input, sessionEvent);

    expect(tx.sessionReminder.create).toHaveBeenCalledTimes(3);
    expect(tx.sessionReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reminderType: 'TWENTY_FOUR_HOURS' }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(4);
    expect(outbox.enqueue.mock.calls.map(([event]) => event.eventType)).toEqual(
      expect.arrayContaining([
        'SESSION_REMINDER_24H',
        'SESSION_REMINDER_1H',
        'SESSION_REMINDER_10M',
      ]),
    );
  });

  it('does not create a second session for the same request', async () => {
    const { repository, tx } = setup();
    tx.learningSession.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await expect(repository.create(sessionId, hostId, input, sessionEvent)).rejects.toThrow(
      'A Session already exists for this SessionRequest.',
    );
  });

  it('cancels pending reminders when a session leaves scheduled status', async () => {
    const { repository, tx, outbox } = setup();
    tx.learningSession.findUnique.mockResolvedValueOnce({
      ...sessionRow,
      status: 'IN_PROGRESS',
    });
    await repository.update(sessionId, 'SCHEDULED', { status: 'IN_PROGRESS' }, [], false);
    expect(tx.sessionReminder.updateMany).toHaveBeenCalledWith({
      where: { sessionId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    expect(outbox.enqueue).toHaveBeenCalledTimes(0);
  });

  it('reschedules existing reminder times without creating duplicates', async () => {
    const { repository, tx, outbox } = setup();
    tx.learningSession.findUnique.mockResolvedValueOnce({
      ...sessionRow,
      scheduledStart: new Date('2026-09-30T12:00:00.000Z'),
    });
    tx.sessionReminder.findUnique.mockResolvedValue({ id: 'reminder-id' });
    await repository.update(
      sessionId,
      'SCHEDULED',
      { scheduledStart: new Date('2026-09-30T12:00:00.000Z') },
      [],
      true,
    );
    expect(tx.sessionReminder.create).not.toHaveBeenCalled();
    expect(tx.sessionReminder.update).toHaveBeenCalledTimes(3);
    expect(tx.sessionReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', sentAt: null }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledTimes(3);
  });
});
