import { Injectable } from '@nestjs/common';
import type { EventEnvelope, NotificationType } from '@campus-skill-exchange/contracts';
import { type NotificationDraft, type NotificationProjector } from './notifications.types';

type Payload = Record<string, unknown>;

function str(payload: Payload, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function rupees(payload: Payload): string {
  const paise = payload.amountPaise;
  if (typeof paise !== 'number' || !Number.isFinite(paise)) return 'your payment';
  const rupeesValue = Math.floor(Math.abs(paise) / 100);
  const grouped = rupeesValue.toLocaleString('en-IN');
  return `₹${grouped}`;
}

const TITLES: Partial<Record<string, string>> = {
  REQUEST_SENT: 'New session request',
  REQUEST_ACCEPTED: 'Session request accepted',
  REQUEST_DECLINED: 'Session request declined',
  SESSION_SCHEDULED: 'Session scheduled',
  SESSION_UPDATED: 'Session updated',
  SESSION_CANCELLED: 'Session cancelled',
  PAYMENT_CAPTURED: 'Payment received',
  PAYMENT_FAILED: 'Payment failed',
  REFUND_REQUESTED: 'Refund requested',
  REFUND_COMPLETED: 'Refund processed',
  BADGE_EARNED: 'New badge earned',
};

const MESSAGES: Record<string, (payload: Payload) => string> = {
  REQUEST_SENT: () => 'Someone asked to exchange a skill with you.',
  REQUEST_ACCEPTED: () => 'Your session request was accepted.',
  REQUEST_DECLINED: () => 'Your session request was declined.',
  SESSION_SCHEDULED: (payload) =>
    `A session is scheduled for ${formatWhen(payload.scheduledStart)}.`,
  SESSION_UPDATED: (payload) =>
    `Session details changed. Status is now ${String(payload.status ?? '')}.`,
  SESSION_CANCELLED: () => 'The session was cancelled.',
  PAYMENT_CAPTURED: (payload) => `${rupees(payload)} was captured for your session.`,
  PAYMENT_FAILED: () => 'Your payment could not be completed. No money was taken.',
  REFUND_REQUESTED: () => 'A refund is being processed with Razorpay.',
  REFUND_COMPLETED: (payload) => `${rupees(payload)} was refunded to you.`,
  BADGE_EARNED: () => 'You earned a new badge.',
};

function formatWhen(value: unknown): string {
  if (typeof value !== 'string') return 'a scheduled time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'a scheduled time';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Maps existing domain events onto in-app notifications.
 *
 * This is the only place that decides who is notified about what, and every
 * recipient is taken from the event payload that the owning module already
 * persisted. Nothing is invented: an event we do not recognise, or one without
 * a resolvable recipient, projects nothing.
 */
@Injectable()
export class DomainEventNotificationProjector implements NotificationProjector {
  project(event: EventEnvelope<Record<string, unknown>>): NotificationDraft[] {
    const type = event.eventType as NotificationType;
    const title = TITLES[event.eventType];
    const message = MESSAGES[event.eventType];
    if (!title || !message || !type) return [];

    const payload = event.payload as Payload;
    const drafts: NotificationDraft[] = [];
    const push = (userId: string | null) => {
      if (!userId) return;
      drafts.push({ userId, type, title, message: message(payload) });
    };

    switch (event.eventType) {
      case 'REQUEST_SENT':
        push(str(payload, 'recipientUserId'));
        break;
      case 'REQUEST_ACCEPTED':
      case 'REQUEST_DECLINED':
        push(str(payload, 'requesterUserId'));
        break;
      case 'SESSION_SCHEDULED':
      case 'SESSION_UPDATED':
      case 'SESSION_CANCELLED': {
        // Both participants care about a schedule change; the actor is skipped
        // so nobody is notified about their own action.
        const actor = event.actorId;
        const host = str(payload, 'hostUserId');
        const participant = str(payload, 'participantUserId');
        if (event.eventType === 'SESSION_CANCELLED') {
          push(actor === host ? participant : host);
        } else {
          if (host !== actor) push(host);
          if (participant !== actor) push(participant);
        }
        break;
      }
      case 'PAYMENT_CAPTURED':
      case 'REFUND_REQUESTED':
      case 'REFUND_COMPLETED':
        push(str(payload, 'recipientUserId'));
        break;
      case 'PAYMENT_FAILED':
        push(str(payload, 'payerUserId'));
        break;
      case 'BADGE_EARNED':
        push(str(payload, 'userId'));
        break;
      default:
        return [];
    }
    return drafts;
  }
}
