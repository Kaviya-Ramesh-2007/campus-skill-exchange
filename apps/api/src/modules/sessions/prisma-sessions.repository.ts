import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateSession,
  EventEnvelope,
  SessionEventPayload,
  SessionPaymentMode,
  SessionReminderEventPayload,
  SessionReminderType,
  SessionStatus,
} from '@campus-skill-exchange/contracts';
import { paidSessionTermsVersion } from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import {
  DuplicateSessionError,
  SessionParticipantError,
  SessionRequestNotAcceptedError,
  type SessionGoogleData,
  type SessionListResult,
  type SessionParticipantDirectory,
  type SessionRecord,
  type SessionRequestRecord,
  type SessionsRepository,
  type SessionUpdate,
} from './sessions.types';
import { reminderDefinition, reminderTimesFor, SESSION_REMINDER_TYPES } from './session-reminders';

const sessionInclude = {
  host: {
    select: {
      id: true,
      displayName: true,
      profile: { select: { publicDisplayName: true } },
    },
  },
  participant: {
    select: {
      id: true,
      displayName: true,
      profile: { select: { publicDisplayName: true } },
    },
  },
  skill: { select: { id: true, name: true } },
} satisfies Prisma.LearningSessionInclude;

type SessionWithRelations = Prisma.LearningSessionGetPayload<{
  include: typeof sessionInclude;
}>;

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async findRequest(requestId: string): Promise<SessionRequestRecord | null> {
    return this.prisma.sessionRequest.findUnique({
      where: { id: requestId },
      select: { requesterUserId: true, recipientUserId: true, skillId: true, status: true },
    });
  }

  async findParticipantEmails(userIds: string[]): Promise<SessionParticipantDirectory[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, displayName: true },
    });
    return users.map((user) => ({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    }));
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const row = await this.prisma.learningSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    return row ? this.mapSession(row) : null;
  }

  async list(userId: string, page: number, limit: number): Promise<SessionListResult> {
    const where: Prisma.LearningSessionWhereInput = {
      OR: [{ hostUserId: userId }, { participantUserId: userId }],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.learningSession.findMany({
        where,
        include: sessionInclude,
        orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.learningSession.count({ where }),
    ]);
    return { items: rows.map((row) => this.mapSession(row)), total };
  }

  async create(
    id: string,
    actorUserId: string,
    input: CreateSession,
    event: EventEnvelope<SessionEventPayload>,
    googleData?: SessionGoogleData | null,
  ): Promise<SessionRecord> {
    const terms = resolvePaidSessionTerms(input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.sessionRequest.findUnique({
          where: { id: input.sessionRequestId },
          select: { requesterUserId: true, recipientUserId: true, skillId: true, status: true },
        });
        if (!request || request.status !== 'ACCEPTED') {
          throw new SessionRequestNotAcceptedError();
        }
        if (actorUserId !== request.requesterUserId && actorUserId !== request.recipientUserId) {
          throw new SessionParticipantError();
        }
        if (request.requesterUserId === request.recipientUserId) {
          throw new SessionParticipantError();
        }
        const existing = await tx.learningSession.findUnique({
          where: { sessionRequestId: input.sessionRequestId },
          select: { id: true },
        });
        if (existing) throw new DuplicateSessionError();

        const row = await tx.learningSession.create({
          data: {
            id,
            sessionRequestId: input.sessionRequestId,
            hostUserId: request.requesterUserId,
            participantUserId: request.recipientUserId,
            skillId: request.skillId,
            mode: input.mode,
            status: 'SCHEDULED',
            scheduledStart: new Date(input.scheduledStart),
            scheduledEnd: new Date(input.scheduledEnd),
            timezone: input.timezone,
            meetingUrl: googleData?.meetingUrl ?? null,
            locationDetails: input.locationDetails ?? null,
            googleCalendarEventId: googleData?.eventId ?? null,
            googleConferenceId: googleData?.conferenceId ?? null,
            googleConferenceStatus: googleData?.conferenceStatus ?? null,
            paymentMode: terms.paymentMode,
            pricePaise: terms.paymentMode === 'PAID' ? terms.pricePaise : null,
            termsVersion: terms.paymentMode === 'PAID' ? terms.termsVersion : null,
          },
          include: sessionInclude,
        });
        await this.outboxWriter.enqueue(event, tx);
        await this.createReminders(tx, row);
        return this.mapSession(row);
      });
    } catch (error) {
      if (error instanceof DuplicateSessionError || this.isUnique(error)) {
        throw new DuplicateSessionError();
      }
      throw error;
    }
  }

  async update(
    id: string,
    fromStatus: SessionStatus,
    update: SessionUpdate,
    events: EventEnvelope<SessionEventPayload>[],
    scheduleChanged: boolean,
    googleData?: SessionGoogleData | null,
  ): Promise<SessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const data = {
        ...update,
        ...(googleData === undefined
          ? {}
          : googleData === null
            ? {
                meetingUrl: null,
                googleCalendarEventId: null,
                googleConferenceId: null,
                googleConferenceStatus: null,
              }
            : {
                meetingUrl: googleData.meetingUrl,
                googleCalendarEventId: googleData.eventId,
                googleConferenceId: googleData.conferenceId,
                googleConferenceStatus: googleData.conferenceStatus,
              }),
      };
      const updated = await tx.learningSession.updateMany({
        where: { id, status: fromStatus },
        data: data as Prisma.LearningSessionUpdateInput,
      });
      if (updated.count === 0) return null;
      const row = await tx.learningSession.findUnique({ where: { id }, include: sessionInclude });
      if (!row) throw new Error('Updated Session could not be reloaded.');
      for (const event of events) await this.outboxWriter.enqueue(event, tx);
      if (row.status !== 'SCHEDULED') {
        await tx.sessionReminder.updateMany({
          where: { sessionId: id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      } else if (scheduleChanged) {
        await this.rescheduleReminders(tx, row);
      }
      return this.mapSession(row);
    });
  }

  private async createReminders(
    tx: Prisma.TransactionClient,
    session: { id: string; scheduledStart: Date },
  ): Promise<void> {
    const times = reminderTimesFor(session.scheduledStart);
    for (const reminderType of SESSION_REMINDER_TYPES) {
      const reminder = await tx.sessionReminder.create({
        data: {
          id: randomUUID(),
          sessionId: session.id,
          reminderType,
          scheduledFor: times[reminderType],
        },
      });
      await this.outboxWriter.enqueue(this.reminderEvent(reminder), tx);
    }
  }

  private async rescheduleReminders(
    tx: Prisma.TransactionClient,
    session: { id: string; scheduledStart: Date },
  ): Promise<void> {
    const times = reminderTimesFor(session.scheduledStart);
    for (const reminderType of SESSION_REMINDER_TYPES) {
      const existing = await tx.sessionReminder.findUnique({
        where: { sessionId_reminderType: { sessionId: session.id, reminderType } },
        select: { id: true },
      });
      const reminder = existing
        ? await tx.sessionReminder.update({
            where: { id: existing.id },
            data: { scheduledFor: times[reminderType], status: 'PENDING', sentAt: null },
          })
        : await tx.sessionReminder.create({
            data: {
              id: randomUUID(),
              sessionId: session.id,
              reminderType,
              scheduledFor: times[reminderType],
            },
          });
      await this.outboxWriter.enqueue(this.reminderEvent(reminder), tx);
    }
  }

  private reminderEvent(reminder: {
    id: string;
    sessionId: string;
    reminderType: SessionReminderType;
    scheduledFor: Date;
  }): EventEnvelope<SessionReminderEventPayload> {
    const definition = reminderDefinition(reminder.reminderType);
    const eventId = randomUUID();
    return {
      eventId,
      eventType: definition.name,
      version: definition.version,
      occurredAt: new Date().toISOString(),
      actorId: null,
      entityType: 'SessionReminder',
      entityId: reminder.id,
      correlationId: null,
      causationId: null,
      idempotencyKey: `session-reminder:${reminder.reminderType}:${reminder.id}:${eventId}`,
      payload: {
        reminderId: reminder.id,
        sessionId: reminder.sessionId,
        reminderType: reminder.reminderType,
        scheduledFor: reminder.scheduledFor.toISOString(),
      },
    };
  }

  private mapSession(row: SessionWithRelations): SessionRecord {
    return {
      id: row.id,
      sessionRequestId: row.sessionRequestId,
      host: {
        userId: row.host.id,
        displayName: row.host.profile?.publicDisplayName ?? row.host.displayName,
      },
      participant: {
        userId: row.participant.id,
        displayName: row.participant.profile?.publicDisplayName ?? row.participant.displayName,
      },
      skill: row.skill ? { id: row.skill.id, name: row.skill.name } : null,
      mode: row.mode,
      status: row.status,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      timezone: row.timezone,
      meetingUrl: row.meetingUrl,
      locationDetails: row.locationDetails,
      googleCalendarEventId: row.googleCalendarEventId,
      googleConferenceId: row.googleConferenceId,
      googleConferenceStatus: row.googleConferenceStatus,
      paymentMode: row.paymentMode,
      pricePaise: row.pricePaise,
      termsVersion: row.termsVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private isUnique(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}

/**
 * Resolves the paid Session terms from a validated create request.
 *
 * The client may propose a mode and a price, but it can never choose the terms
 * version: the API stamps the current version so `POST /payments/order` can
 * reject a payer who accepted stale terms. The shape written here always
 * satisfies the `learning_sessions_payment_terms_check` database constraint.
 */
function resolvePaidSessionTerms(input: CreateSession): {
  paymentMode: SessionPaymentMode;
  pricePaise: number | null;
  termsVersion: string | null;
} {
  if (input.paymentMode !== 'PAID' || input.pricePaise === undefined) {
    return { paymentMode: 'FREE', pricePaise: null, termsVersion: null };
  }
  return {
    paymentMode: 'PAID',
    pricePaise: input.pricePaise,
    termsVersion: paidSessionTermsVersion,
  };
}
