import { randomUUID } from 'node:crypto';
import type { EventEnvelope } from '@campus-skill-exchange/contracts';
import {
  DuplicateSessionRequestError,
  type RequestsRepository,
  type SessionRequestRecord,
} from '../../src/modules/requests/requests.types';
import type {
  SessionRecord,
  SessionsRepository,
  SessionUpdate,
} from '../../src/modules/sessions/sessions.types';
import {
  DuplicateRatingError,
  type RatingsRepository,
} from '../../src/modules/ratings/ratings.types';
import {
  DuplicateAssessmentError,
  type AssessmentsRepository,
} from '../../src/modules/assessments/assessments.types';
import type { ReputationRepository } from '../../src/modules/reputation/reputation.types';
import type { BadgesRepository } from '../../src/modules/badges/badges.types';
import type { PaymentsRepository } from '../../src/modules/payments/payments.types';
import type { NotificationsRepository } from '../../src/modules/notifications/notifications.types';
import type { ReportsRepository } from '../../src/modules/reports/reports.types';

const now = () => new Date('2026-10-01T12:00:00.000Z');

/**
 * One shared in-memory world used by the cross-module integration suites.
 *
 * Every repository below is deliberately simple, but they all read and write
 * the SAME state, so a request accepted in one module really is the session
 * created in the next. That is what makes these integration tests rather than
 * unit tests with extra steps.
 */
export class IntegrationStore {
  users = new Set<string>();
  verifiedCertificationUsers = new Set<string>();
  requests = new Map<string, any>();
  sessions = new Map<string, SessionRecord>();
  ratings: any[] = [];
  assessments: any[] = [];
  badgeDefinitions = new Map<string, any>();
  userBadges: any[] = [];
  payments = new Map<string, any>();
  transactions: any[] = [];
  notifications: any[] = [];
  reports: any[] = [];
  /** Every domain event published through the outbox during the flow. */
  events: EventEnvelope<any>[] = [];

  addUser(id: string, opts: { verifiedCertification?: boolean } = {}) {
    this.users.add(id);
    if (opts.verifiedCertification) this.verifiedCertificationUsers.add(id);
    return id;
  }

  outboxWriter = {
    enqueue: async (event: EventEnvelope) => {
      this.events.push(event);
    },
  };

  // ---------------------------------------------------------------- requests
  requestsRepository = (): RequestsRepository => ({
    findById: async (id) => this.requests.get(id) ?? null,
    list: async (userId, _page, _limit) => {
      const items = [...this.requests.values()].filter(
        (r) => r.requester.userId === userId || r.recipient.userId === userId,
      );
      return { items, total: items.length };
    },
    create: async (id, requesterUserId, input, event) => {
      // Mirrors the real unique constraint on an open request between two Users.
      const duplicate = [...this.requests.values()].some(
        (r) =>
          r.status === 'PENDING' &&
          r.requester.userId === requesterUserId &&
          r.recipient.userId === input.recipientUserId,
      );
      if (duplicate) throw new DuplicateSessionRequestError();
      const identity = (userId: string) => ({
        userId,
        displayName: `User ${userId.slice(-4)}`,
      });
      const record: SessionRequestRecord = {
        id,
        requester: identity(requesterUserId),
        recipient: identity(input.recipientUserId),
        skill: input.skillId
          ? { id: input.skillId, name: `Skill ${input.skillId.slice(-4)}` }
          : null,
        message: input.message ?? null,
        status: 'PENDING',
        createdAt: now(),
        updatedAt: now(),
      };
      this.requests.set(id, record);
      this.events.push(event);
      return record;
    },
    updateStatus: async (id, status, event) => {
      const record = this.requests.get(id);
      if (!record) return null;
      record.status = status;
      record.updatedAt = now();
      this.events.push(event);
      return record;
    },
  });

  // ---------------------------------------------------------------- sessions
  sessionsRepository = (): SessionsRepository => ({
    findRequest: async (requestId) => {
      const request = this.requests.get(requestId);
      if (!request) return null;
      return {
        requesterUserId: request.requester.userId,
        recipientUserId: request.recipient.userId,
        skillId: request.skill?.id ?? null,
        status: request.status,
      };
    },
    findParticipantEmails: async (ids) =>
      ids.map((userId) => ({ userId, email: `${userId}@example.test`, displayName: userId })),
    findById: async (id) => this.sessions.get(id) ?? null,
    list: async (userId, _page, _limit) => {
      const items = [...this.sessions.values()].filter(
        (s) => s.host.userId === userId || s.participant.userId === userId,
      );
      return { items, total: items.length };
    },
    create: async (id, _actorUserId, input, event, googleData) => {
      const request = this.requests.get(input.sessionRequestId)!;
      const record: SessionRecord = {
        id,
        sessionRequestId: input.sessionRequestId,
        host: request.requester,
        participant: request.recipient,
        skill: request.skill,
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
        paymentMode: input.paymentMode ?? 'FREE',
        pricePaise: input.paymentMode === 'PAID' ? (input.pricePaise ?? null) : null,
        termsVersion: input.paymentMode === 'PAID' ? 'terms-in-force' : null,
        createdAt: now(),
        updatedAt: now(),
      };
      this.sessions.set(id, record);
      this.events.push(event);
      return record;
    },
    update: async (id, fromStatus, update: SessionUpdate, events) => {
      const record = this.sessions.get(id);
      if (!record || record.status !== fromStatus) return null;
      Object.assign(record, update);
      record.updatedAt = now();
      for (const event of events ?? []) this.events.push(event);
      return record;
    },
  });

  // ----------------------------------------------------------------- ratings
  ratingsRepository = (): RatingsRepository => ({
    findSession: async (sessionId) => {
      const session = this.sessions.get(sessionId);
      if (!session) return null;
      return {
        id: session.id,
        status: session.status,
        host: session.host,
        participant: session.participant,
      };
    },
    listForSession: async (sessionId) => this.ratings.filter((r) => r.sessionId === sessionId),
    create: async (id, raterUserId, input, event) => {
      if (
        this.ratings.some((r) => r.sessionId === input.sessionId && r.rater.userId === raterUserId)
      ) {
        throw new DuplicateRatingError();
      }
      const session = this.sessions.get(input.sessionId)!;
      const ratedUser = session.host.userId === raterUserId ? session.participant : session.host;
      const record = {
        id,
        sessionId: input.sessionId,
        rater: session.host.userId === raterUserId ? session.host : session.participant,
        ratedUser,
        rating: input.rating,
        feedback: input.feedback ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      this.ratings.push(record);
      this.events.push(event);
      return record;
    },
  });

  // ------------------------------------------------------------- assessments
  assessmentsRepository = (): AssessmentsRepository => ({
    findSession: async (sessionId) => {
      const session = this.sessions.get(sessionId);
      if (!session) return null;
      return {
        id: session.id,
        status: session.status as any,
        hostUserId: session.host.userId,
        participantUserId: session.participant.userId,
        skillId: session.skill?.id ?? null,
        host: session.host,
        participant: session.participant,
      };
    },
    listForUser: async (userId) =>
      this.assessments.filter(
        (a) => a.assessor.userId === userId || a.assessedUser.userId === userId,
      ),
    listForSession: async (sessionId) => this.assessments.filter((a) => a.sessionId === sessionId),
    create: async (id, assessorUserId, input, event) => {
      if (
        this.assessments.some(
          (a) => a.sessionId === input.sessionId && a.assessor.userId === assessorUserId,
        )
      ) {
        throw new DuplicateAssessmentError();
      }
      const session = this.sessions.get(input.sessionId)!;
      const assessed = session.host.userId === assessorUserId ? session.participant : session.host;
      const record = {
        id,
        sessionId: input.sessionId,
        assessor: session.host.userId === assessorUserId ? session.host : session.participant,
        assessedUser: assessed,
        skill: input.skillId
          ? { id: input.skillId, name: `Skill ${input.skillId.slice(-4)}` }
          : session.skill,
        understandingScore: input.understandingScore,
        practicalApplicationScore: input.practicalApplicationScore,
        problemSolvingScore: input.problemSolvingScore,
        communicationScore: input.communicationScore,
        reliabilityScore: input.reliabilityScore,
        feedback: input.feedback ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      this.assessments.push(record);
      this.events.push(event);
      return record;
    },
  });

  // -------------------------------------------------------------- reputation
  reputationRepository = (): ReputationRepository => ({
    userExists: async (userId) => this.users.has(userId),
    getSummary: async (userId) => {
      const completedSessions = [...this.sessions.values()].filter(
        (s) =>
          s.status === 'COMPLETED' && (s.host.userId === userId || s.participant.userId === userId),
      ).length;
      const received = this.ratings.filter((r) => r.ratedUser.userId === userId);
      const receivedAssessments = this.assessments.filter((a) => a.assessedUser.userId === userId);
      const average = (values: number[]) =>
        values.length === 0
          ? null
          : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
      return {
        userId,
        completedSessions,
        averageRating: average(received.map((r) => r.rating)),
        ratingCount: received.length,
        assessmentCount: receivedAssessments.length,
        assessmentAverages: {
          understandingScore: average(receivedAssessments.map((a) => a.understandingScore)),
          practicalApplicationScore: average(
            receivedAssessments.map((a) => a.practicalApplicationScore),
          ),
          problemSolvingScore: average(receivedAssessments.map((a) => a.problemSolvingScore)),
          communicationScore: average(receivedAssessments.map((a) => a.communicationScore)),
          reliabilityScore: average(receivedAssessments.map((a) => a.reliabilityScore)),
        },
        badgeCount: this.userBadges.filter((b) => b.userId === userId).length,
      };
    },
  });

  // ------------------------------------------------------------------ badges
  badgesRepository = (): BadgesRepository => ({
    createBadgeDefinition: async (input) => {
      const id = randomUUID();
      const record = {
        id,
        ...input,
        iconUrl: input.iconUrl ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      this.badgeDefinitions.set(id, record);
      return record;
    },
    listDefinitions: async () => [...this.badgeDefinitions.values()],
    awardBadge: async (id, userId, badgeDefinitionId, event) => {
      const existing = this.userBadges.find(
        (b) => b.userId === userId && b.badgeDefinitionId === badgeDefinitionId,
      );
      // Idempotent: no second event, exactly like the real repository.
      if (existing) return { badge: existing, created: false };
      const definition = this.badgeDefinitions.get(badgeDefinitionId)!;
      const badge = {
        id,
        userId,
        badgeDefinitionId,
        awardedAt: now(),
        badgeDefinition: definition,
      };
      this.userBadges.push(badge);
      this.events.push(event);
      return { badge, created: true };
    },
    listForUser: async (userId) => this.userBadges.filter((b) => b.userId === userId),
  });

  // ---------------------------------------------------------------- payments
  paymentsRepository = (): PaymentsRepository =>
    ({
      findSession: async (sessionId) => {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        return {
          id: session.id,
          hostUserId: session.host.userId,
          participantUserId: session.participant.userId,
          paymentMode: session.paymentMode,
          pricePaise: session.pricePaise,
          termsVersion: session.termsVersion,
          status: session.status,
        };
      },
      existsForSession: async (sessionId) =>
        [...this.payments.values()].some((p) => p.sessionId === sessionId),
      hasVerifiedPaidEvidence: async (userId: string) =>
        this.verifiedCertificationUsers.has(userId),
      findById: async (id) => this.payments.get(id) ?? null,
      findBySessionAndPayer: async (sessionId, payerUserId) =>
        [...this.payments.values()].find(
          (p) => p.sessionId === sessionId && p.payerUserId === payerUserId,
        ) ?? null,
      findByProviderOrderId: async (orderId) =>
        [...this.payments.values()].find((p) => p.providerOrderId === orderId) ?? null,
      findByProviderPaymentId: async (paymentId) =>
        [...this.payments.values()].find((p) => p.providerPaymentId === paymentId) ?? null,
      create: async (id, session, payerUserId, recipientUserId, termsVersion) => {
        const record = {
          id,
          sessionId: session.id,
          payerUserId,
          recipientUserId,
          amountPaise: session.pricePaise as number,
          currency: 'INR' as const,
          provider: 'RAZORPAY' as const,
          providerOrderId: null,
          providerPaymentId: null,
          status: 'CREATED' as const,
          termsVersion,
          termsAcceptedAt: now(),
          termsAcceptedBy: payerUserId,
          paidAt: null,
          failureReason: null,
          refundAmountPaise: 0,
          refundProviderId: null,
          refundReason: null,
          refundedAt: null,
          transactions: [] as any[],
          createdAt: now(),
          updatedAt: now(),
        };
        this.payments.set(id, record);
        return record;
      },
      attachProviderOrder: async (id, providerOrderId) => {
        const record = this.payments.get(id)!;
        record.providerOrderId = providerOrderId;
        record.status = 'PENDING' as any;
        return record;
      },
      authorize: async (id, providerPaymentId) => {
        const record = this.payments.get(id)!;
        record.status = 'AUTHORIZED' as any;
        record.providerPaymentId = providerPaymentId;
        return record;
      },
      capture: async (id, providerPaymentId) => {
        const record = this.payments.get(id)!;
        record.status = 'CAPTURED' as any;
        record.providerPaymentId = providerPaymentId;
        record.paidAt = now();
        return record;
      },
      fail: async (id, reason) => {
        const record = this.payments.get(id)!;
        record.status = 'FAILED' as any;
        record.failureReason = reason;
        return record;
      },
      requestRefund: async (id) => {
        const record = this.payments.get(id)!;
        record.status = 'REFUND_PENDING' as any;
        return record;
      },
      completeRefund: async (id, providerRefundId, status) => {
        const record = this.payments.get(id)!;
        record.status = status as any;
        record.refundProviderId = providerRefundId;
        return record;
      },
      pendingRefundTransactionId: async () => null,
      hasProcessedProviderEvent: async () => false,
      listHistory: async (userId, includeAll) =>
        [...this.payments.values()].filter(
          (p) => includeAll || p.payerUserId === userId || p.recipientUserId === userId,
        ),
    }) as PaymentsRepository;

  // ----------------------------------------------------------- notifications
  notificationsRepository = (): NotificationsRepository => ({
    createMany: async (rows) => {
      for (const row of rows as any[]) {
        this.notifications.push({ ...row, readAt: null, createdAt: now() });
      }
    },
    list: async (userId, page, limit) => {
      const items = this.notifications.filter((n) => n.userId === userId);
      return { items: items.slice((page - 1) * limit, page * limit), total: items.length };
    },
    unreadCount: async (userId) =>
      this.notifications.filter((n) => n.userId === userId && !n.readAt).length,
    markRead: async (id, userId) => {
      const row = this.notifications.find((n) => n.id === id && n.userId === userId);
      if (row && !row.readAt) row.readAt = now();
      return row ?? null;
    },
    markAllRead: async (userId) => {
      let count = 0;
      for (const row of this.notifications) {
        if (row.userId === userId && !row.readAt) {
          row.readAt = now();
          count += 1;
        }
      }
      return count;
    },
  });

  // ----------------------------------------------------------------- reports
  reportsRepository = (): ReportsRepository => ({
    reportedUserExists: async (userId) => this.users.has(userId),
    create: async (id, reporterUserId, reportedUserId, category, description) => {
      const record = {
        id,
        reporterUserId,
        reportedUserId,
        category,
        description,
        status: 'OPEN' as const,
        createdAt: now(),
        updatedAt: now(),
        resolvedAt: null,
      };
      this.reports.push(record);
      return record;
    },
    list: async (viewerUserId, isAdmin) =>
      isAdmin ? [...this.reports] : this.reports.filter((r) => r.reporterUserId === viewerUserId),
    findById: async (id) => this.reports.find((r) => r.id === id) ?? null,
    updateStatus: async (id, status) => {
      const record = this.reports.find((r) => r.id === id)!;
      record.status = status;
      return record;
    },
  });
}
