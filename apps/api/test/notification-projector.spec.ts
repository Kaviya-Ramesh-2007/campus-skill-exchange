import { describe, expect, it } from 'vitest';
import type { EventEnvelope } from '@campus-skill-exchange/contracts';
import { DomainEventNotificationProjector } from '../src/modules/notifications/notification-projector';

const host = '00000000-0000-4000-8000-000000000001';
const participant = '00000000-0000-4000-8000-000000000002';

function envelope(
  eventType: string,
  payload: Record<string, unknown>,
  actorId: string | null = null,
) {
  return {
    eventId: '00000000-0000-4000-8000-000000000003',
    eventType,
    version: 1,
    occurredAt: '2026-10-01T12:00:00.000Z',
    actorId,
    entityType: 'X',
    entityId: '00000000-0000-4000-8000-000000000004',
    correlationId: null,
    causationId: null,
    idempotencyKey: 'k',
    payload,
  } as unknown as EventEnvelope<Record<string, unknown>>;
}

describe('DomainEventNotificationProjector', () => {
  const projector = new DomainEventNotificationProjector();

  it('notifies the recipient of a sent request', () => {
    const drafts = projector.project(
      envelope('REQUEST_SENT', { requesterUserId: host, recipientUserId: participant }),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!).toMatchObject({ userId: participant, type: 'REQUEST_SENT' });
  });

  it('notifies the requester when a request is accepted or declined', () => {
    for (const type of ['REQUEST_ACCEPTED', 'REQUEST_DECLINED']) {
      const drafts = projector.project(
        envelope(type, { requesterUserId: host, recipientUserId: participant }),
      );
      expect(drafts[0]!).toMatchObject({ userId: host, type });
    }
  });

  it('notifies both participants about a scheduled session but not the actor', () => {
    const drafts = projector.project(
      envelope(
        'SESSION_SCHEDULED',
        {
          hostUserId: host,
          participantUserId: participant,
          scheduledStart: '2026-10-04T12:00:00.000Z',
        },
        host,
      ),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.userId).toBe(participant);
  });

  it('notifies only the other participant when a session is cancelled', () => {
    const drafts = projector.project(
      envelope('SESSION_CANCELLED', { hostUserId: host, participantUserId: participant }, host),
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.userId).toBe(participant);
  });

  it('notifies the recipient about a captured payment and the payer about a failure', () => {
    const captured = projector.project(
      envelope('PAYMENT_CAPTURED', {
        payerUserId: participant,
        recipientUserId: host,
        amountPaise: 15000,
      }),
    );
    expect(captured[0]!).toMatchObject({ userId: host, type: 'PAYMENT_CAPTURED' });
    expect(captured[0]!.message).toContain('₹150');

    const failed = projector.project(
      envelope('PAYMENT_FAILED', { payerUserId: participant, recipientUserId: host }),
    );
    expect(failed[0]!).toMatchObject({ userId: participant, type: 'PAYMENT_FAILED' });
    expect(failed[0]!.message).toContain('No money was taken');
  });

  it('notifies a User about their own earned badge', () => {
    const drafts = projector.project(envelope('BADGE_EARNED', { userId: host }));
    expect(drafts[0]!).toMatchObject({ userId: host, type: 'BADGE_EARNED' });
  });

  it('projects nothing for an event it does not handle', () => {
    expect(projector.project(envelope('RATING_SUBMITTED', { raterUserId: host }))).toEqual([]);
    expect(projector.project(envelope('SOMETHING_ELSE', {}))).toEqual([]);
  });

  it('never fabricates a recipient when the payload is missing one', () => {
    expect(projector.project(envelope('REQUEST_SENT', { requesterUserId: host }))).toEqual([]);
    expect(projector.project(envelope('PAYMENT_CAPTURED', {}))).toEqual([]);
  });
});
