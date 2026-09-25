import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import type { PaymentsService } from '../src/modules/payments/payments.service';
import {
  DuplicateSessionError,
  type SessionListResult,
  type SessionRecord,
  type SessionRequestRecord,
  type SessionsRepository,
  type SessionUpdate,
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
const skillId = '00000000-0000-4000-8000-000000000006';
const start = '2026-09-30T10:00:00.000Z';
const end = '2026-09-30T11:00:00.000Z';
const now = new Date('2026-09-29T00:00:00.000Z');

const baseInput: CreateSession = {
  sessionRequestId: requestId,
  // OFFLINE keeps the Google Calendar branch out of these payment-focused tests.
  mode: 'OFFLINE',
  scheduledStart: start,
  scheduledEnd: end,
  timezone: 'UTC',
  locationDetails: 'Campus library, room 4',
};

class FakeSessionsRepository implements SessionsRepository {
  request: SessionRequestRecord = {
    requesterUserId: hostId,
    recipientUserId: participantId,
    skillId,
    status: 'ACCEPTED',
  };
  stored: SessionRecord | null = null;

  async findRequest() {
    return this.request;
  }
  async findById() {
    return this.stored;
  }
  async list(): Promise<SessionListResult> {
    return { items: this.stored ? [this.stored] : [], total: this.stored ? 1 : 0 };
  }
  async create(
    id: string,
    _actorUserId: string,
    data: CreateSession,
    _event: EventEnvelope<SessionEventPayload>,
  ): Promise<SessionRecord> {
    if (this.stored) throw new DuplicateSessionError();
    const row: SessionRecord = {
      id,
      sessionRequestId: data.sessionRequestId,
      host: { userId: hostId, displayName: 'Host' },
      participant: { userId: participantId, displayName: 'Participant' },
      skill: { id: skillId, name: 'Advanced Python' },
      mode: data.mode,
      status: 'SCHEDULED',
      scheduledStart: new Date(data.scheduledStart),
      scheduledEnd: new Date(data.scheduledEnd),
      timezone: data.timezone,
      meetingUrl: null,
      locationDetails: null,
      googleCalendarEventId: null,
      googleConferenceId: null,
      googleConferenceStatus: null,
      paymentMode: data.paymentMode ?? 'FREE',
      pricePaise: data.paymentMode === 'PAID' ? (data.pricePaise ?? null) : null,
      termsVersion: data.paymentMode === 'PAID' ? 'terms' : null,
      createdAt: now,
      updatedAt: now,
    };
    this.stored = row;
    return row;
  }
  async update(
    _id: string,
    _fromStatus: SessionStatus,
    update: SessionUpdate,
  ): Promise<SessionRecord | null> {
    if (!this.stored) return null;
    this.stored = { ...this.stored, ...update } as SessionRecord;
    return this.stored;
  }
}

/** Stands in for the real Payments module; only the two reused rules matter. */
function fakePayments(eligible: boolean, hasPayment = false) {
  return {
    assertCanOfferPaidSession: async (userId: string) => {
      if (!eligible) throw new Error('The recipient is not eligible to offer a paid Session.');
      if (userId !== hostId) throw new Error('wrong host');
    },
    hasPaymentForSession: async () => hasPayment,
  } as unknown as PaymentsService;
}

function setup(eligible = true, hasPayment = false) {
  const repository = new FakeSessionsRepository();
  const service = new SessionsService(repository, undefined, fakePayments(eligible, hasPayment));
  return { repository, service };
}

describe('SessionsService paid Session creation', () => {
  it('creates a PAID session and stamps the server-owned terms version', async () => {
    const { service, repository } = setup();
    const result = await service.create(hostId, {
      ...baseInput,
      paymentMode: 'PAID',
      pricePaise: 15000,
    });

    expect(result.paymentMode).toBe('PAID');
    expect(result.pricePaise).toBe(15000);
    expect(result.termsVersion).toBeTruthy();
    expect(repository.stored?.termsVersion).toBe(result.termsVersion);
  });

  it('rejects a PAID session when the host lacks verified evidence', async () => {
    const { service } = setup(false);
    await expect(
      service.create(hostId, { ...baseInput, paymentMode: 'PAID', pricePaise: 15000 }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects a PAID session without a positive price', async () => {
    const { service } = setup();
    await expect(
      service.create(hostId, { ...baseInput, paymentMode: 'PAID' }),
    ).rejects.toBeInstanceOf(ApiException);
    await expect(
      service.create(hostId, { ...baseInput, paymentMode: 'PAID', pricePaise: 0 }),
    ).rejects.toBeInstanceOf(ApiException);
    await expect(
      service.create(hostId, { ...baseInput, paymentMode: 'PAID', pricePaise: -100 }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects a price on a FREE session', async () => {
    const { service } = setup();
    await expect(
      service.create(hostId, { ...baseInput, paymentMode: 'FREE', pricePaise: 15000 }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('keeps FREE sessions working with no payment involved', async () => {
    const { service, repository } = setup();
    const result = await service.create(hostId, baseInput);
    expect(result.paymentMode).toBe('FREE');
    expect(result.pricePaise).toBeNull();
    expect(result.termsVersion).toBeNull();
    expect(repository.stored).not.toBeNull();
  });
});

describe('SessionsService paid Session updates', () => {
  it('rejects changing paid terms once a payment has been started', async () => {
    const { service } = setup(true, true);
    const created = await service.create(hostId, {
      ...baseInput,
      paymentMode: 'PAID',
      pricePaise: 15000,
    });

    await expect(service.update(created.id, hostId, { pricePaise: 1 })).rejects.toBeTruthy();
  });

  it('locks paid terms once the session is no longer scheduled', async () => {
    const { service, repository } = setup();
    const created = await service.create(hostId, {
      ...baseInput,
      paymentMode: 'PAID',
      pricePaise: 15000,
    });
    if (repository.stored) repository.stored = { ...repository.stored, status: 'IN_PROGRESS' };

    await expect(service.update(created.id, hostId, { pricePaise: 9900 })).rejects.toBeTruthy();
  });
});
