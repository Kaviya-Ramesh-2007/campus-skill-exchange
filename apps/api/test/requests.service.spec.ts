import { describe, expect, it } from 'vitest';
import { RequestsService } from '../src/modules/requests/requests.service';
import {
  DuplicateSessionRequestError,
  RequestRecipientNotFoundError,
  RequestSkillNotFoundError,
  type RequestsRepository,
  type SessionRequestListResult,
  type SessionRequestRecord,
} from '../src/modules/requests/requests.types';
import type {
  CreateSessionRequest,
  EventEnvelope,
  SessionRequestEventPayload,
} from '@campus-skill-exchange/contracts';

const requesterId = '00000000-0000-4000-8000-000000000001';
const recipientId = '00000000-0000-4000-8000-000000000002';
const unrelatedId = '00000000-0000-4000-8000-000000000003';
const skillId = '00000000-0000-4000-8000-000000000005';
const otherSkillId = '00000000-0000-4000-8000-000000000006';
const now = new Date('2026-09-29T00:00:00.000Z');

class FakeRequestsRepository implements RequestsRepository {
  readonly events: EventEnvelope<SessionRequestEventPayload>[] = [];
  private readonly requests = new Map<string, SessionRequestRecord>();

  async findById(id: string): Promise<SessionRequestRecord | null> {
    return this.requests.get(id) ?? null;
  }

  async list(userId: string, page: number, limit: number): Promise<SessionRequestListResult> {
    const items = [...this.requests.values()].filter(
      (item) => item.requester.userId === userId || item.recipient.userId === userId,
    );
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length };
  }

  async create(
    id: string,
    requesterUserId: string,
    input: CreateSessionRequest,
    event: EventEnvelope<SessionRequestEventPayload>,
  ): Promise<SessionRequestRecord> {
    if (input.recipientUserId === unrelatedId) throw new RequestRecipientNotFoundError();
    if (input.skillId === otherSkillId) throw new RequestSkillNotFoundError();
    if (
      [...this.requests.values()].some(
        (item) =>
          item.requester.userId === requesterUserId &&
          item.recipient.userId === input.recipientUserId &&
          item.skill?.id === input.skillId &&
          ['PENDING', 'ACCEPTED'].includes(item.status),
      )
    ) {
      throw new DuplicateSessionRequestError();
    }
    const row: SessionRequestRecord = {
      id,
      requester: { userId: requesterUserId, displayName: 'Requester' },
      recipient: { userId: input.recipientUserId, displayName: 'Recipient' },
      skill: input.skillId ? { id: input.skillId, name: 'AWS' } : null,
      message: input.message ?? null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    this.requests.set(id, row);
    this.events.push(event);
    return row;
  }

  async updateStatus(
    id: string,
    status: Exclude<SessionRequestRecord['status'], 'PENDING'>,
    event: EventEnvelope<SessionRequestEventPayload>,
  ): Promise<SessionRequestRecord | null> {
    const existing = this.requests.get(id);
    if (!existing || existing.status !== 'PENDING') return null;
    const updated = { ...existing, status, updatedAt: new Date() };
    this.requests.set(id, updated);
    this.events.push(event);
    return updated;
  }
}

function serviceWithRepository() {
  const repository = new FakeRequestsRepository();
  return { repository, service: new RequestsService(repository) };
}

async function pending(service: RequestsService) {
  return service.create(requesterId, {
    recipientUserId: recipientId,
    skillId,
    message: 'Please help',
  });
}

describe('RequestsService', () => {
  it('creates a pending request and emits REQUEST_SENT', async () => {
    const { repository, service } = serviceWithRepository();
    const result = await service.create(requesterId, {
      recipientUserId: recipientId,
      skillId,
      message: 'Please help',
    });

    expect(result).toMatchObject({
      requester: { userId: requesterId },
      recipient: { userId: recipientId },
      skill: { id: skillId },
      status: 'PENDING',
    });
    expect(repository.events[0]).toMatchObject({
      eventType: 'REQUEST_SENT',
      actorId: requesterId,
      payload: { requestId: result.id, status: 'PENDING' },
    });
  });

  it('rejects self requests and invalid recipients or skills', async () => {
    const { service } = serviceWithRepository();
    await expect(service.create(requesterId, { recipientUserId: requesterId })).rejects.toThrow();
    await expect(service.create(requesterId, { recipientUserId: unrelatedId })).rejects.toThrow();
    await expect(
      service.create(requesterId, { recipientUserId: recipientId, skillId: otherSkillId }),
    ).rejects.toThrow();
  });

  it('lists requests involving the current User', async () => {
    const { service } = serviceWithRepository();
    await pending(service);
    const result = await service.list(recipientId, {});

    expect(result.total).toBe(1);
    expect(result.items[0]?.recipient.userId).toBe(recipientId);
  });

  it('allows the recipient to accept and emits REQUEST_ACCEPTED', async () => {
    const { repository, service } = serviceWithRepository();
    const created = await pending(service);
    const result = await service.update(created.id, recipientId, { status: 'ACCEPTED' });

    expect(result.status).toBe('ACCEPTED');
    expect(repository.events.at(-1)).toMatchObject({ eventType: 'REQUEST_ACCEPTED' });
  });

  it('allows the recipient to decline and emits REQUEST_DECLINED', async () => {
    const { repository, service } = serviceWithRepository();
    const created = await pending(service);
    const result = await service.update(created.id, recipientId, { status: 'DECLINED' });

    expect(result.status).toBe('DECLINED');
    expect(repository.events.at(-1)).toMatchObject({ eventType: 'REQUEST_DECLINED' });
  });

  it('allows the requester to cancel and emits REQUEST_CANCELLED', async () => {
    const { repository, service } = serviceWithRepository();
    const created = await pending(service);
    const result = await service.update(created.id, requesterId, { status: 'CANCELLED' });

    expect(result.status).toBe('CANCELLED');
    expect(repository.events.at(-1)).toMatchObject({ eventType: 'REQUEST_CANCELLED' });
  });

  it('rejects unrelated updates and invalid transitions', async () => {
    const { service } = serviceWithRepository();
    const created = await pending(service);
    await expect(service.update(created.id, unrelatedId, { status: 'ACCEPTED' })).rejects.toThrow();
    await expect(service.update(created.id, requesterId, { status: 'ACCEPTED' })).rejects.toThrow();
    await service.update(created.id, recipientId, { status: 'ACCEPTED' });
    await expect(service.update(created.id, recipientId, { status: 'DECLINED' })).rejects.toThrow();
  });

  it('rejects duplicate active requests', async () => {
    const { service } = serviceWithRepository();
    await pending(service);
    await expect(
      service.create(requesterId, { recipientUserId: recipientId, skillId }),
    ).rejects.toThrow();
  });
});
