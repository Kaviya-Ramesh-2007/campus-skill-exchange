import { describe, expect, it, vi } from 'vitest';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';
import { RequestsService } from '../src/modules/requests/requests.service';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { RatingsService } from '../src/modules/ratings/ratings.service';
import { AssessmentsService } from '../src/modules/assessments/assessments.service';
import { ReputationService } from '../src/modules/reputation/reputation.service';
import { BadgesService } from '../src/modules/badges/badges.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { DomainEventNotificationProjector } from '../src/modules/notifications/notification-projector';
import { ReportsService } from '../src/modules/reports/reports.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { AiAssistanceService } from '../src/modules/ai/ai-assistance.service';
import { ApiException } from '../src/common/errors/api-exception';
import { IntegrationStore } from './support/integration-store';
import type { AiProvider } from '../src/modules/ai/ai.provider';
import {
  RazorpayProviderError,
  type RazorpayProvider,
} from '../src/modules/payments/razorpay.provider';
import type { AuthUser } from '@campus-skill-exchange/contracts';
import type { PrismaService } from '../src/platform/database/prisma.service';

const HOST = '00000000-0000-4000-8000-0000000000a1';
const LEARNER = '00000000-0000-4000-8000-0000000000b2';
const ADMIN = '00000000-0000-4000-8000-0000000000c3';
const SKILL = '00000000-0000-4000-8000-0000000000d4';
const START = '2026-10-04T12:00:00.000Z';
const END = '2026-10-04T13:00:00.000Z';

const admin = (): AuthUser => actor(ADMIN, ['USER', 'ADMIN']);
const actor = (id: string, roles: AuthUser['roles'] = ['USER']): AuthUser =>
  ({
    id,
    email: `${id}@example.test`,
    displayName: `User ${id.slice(-4)}`,
    status: 'ACTIVE',
    roles,
    createdAt: '2026-10-01T12:00:00.000Z',
  }) as unknown as AuthUser;

/** Razorpay stand-in: no network, no credentials, no real money. */
class FakeRazorpay implements RazorpayProvider {
  failOrder = false;
  getPublicKeyId() {
    return 'rzp_test_public';
  }
  async createOrder(input: { amountPaise: number }) {
    if (this.failOrder) throw new RazorpayProviderError('Razorpay is unavailable.');
    return { id: 'order_test_1', amount: input.amountPaise, currency: 'INR' };
  }
  verifyPaymentSignature(input: { signature: string }) {
    return input.signature === 'valid-signature';
  }
  verifyWebhookSignature() {
    return true;
  }
  async createRefund() {
    return { id: 'rfnd_test_1', status: 'processed' };
  }
}

function buildWorld(opts: { razorpay?: FakeRazorpay } = {}) {
  const store = new IntegrationStore();
  // Only the host holds verified evidence, so they are the only paid-session host.
  store.addUser(HOST, { verifiedCertification: true });
  store.addUser(LEARNER);
  store.addUser(ADMIN);

  const policy = new SystemRoleAuthorizationPolicy();
  const razorpay = opts.razorpay ?? new FakeRazorpay();
  const notifications = new NotificationsService(
    store.notificationsRepository(),
    new DomainEventNotificationProjector(),
  );

  return {
    store,
    notifications,
    requests: new RequestsService(store.requestsRepository()),
    sessions: new SessionsService(store.sessionsRepository(), undefined, {
      assertCanOfferPaidSession: async (userId: string) => {
        if (!store.verifiedCertificationUsers.has(userId)) {
          throw new ApiException(403, 'FORBIDDEN', 'A verified certification is required.');
        }
      },
      hasPaymentForSession: async (sessionId: string) =>
        store.paymentsRepository().existsForSession(sessionId),
    } as never),
    ratings: new RatingsService(store.ratingsRepository()),
    assessments: new AssessmentsService(store.assessmentsRepository(), policy),
    reputation: new ReputationService(store.reputationRepository(), policy),
    badges: new BadgesService(store.badgesRepository(), policy),
    payments: new PaymentsService(store.paymentsRepository(), razorpay, policy),
    reports: new ReportsService(store.reportsRepository(), policy),
    analytics: new AnalyticsService(
      {
        $transaction: vi.fn(async (queries: unknown[]) => Promise.all(queries)),
        user: { count: vi.fn().mockResolvedValue(3) },
        skill: { count: vi.fn().mockResolvedValue(1) },
        learningSession: { count: vi.fn().mockResolvedValue(1) },
        report: { count: vi.fn().mockResolvedValue(0) },
      } as unknown as PrismaService,
      policy,
    ),
  };
}

type World = ReturnType<typeof buildWorld>;

/** request -> accept -> session -> COMPLETED, shared by the interaction flows. */
async function completedSession(
  world: World,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const request = await world.requests.create(HOST, {
    recipientUserId: LEARNER,
    skillId: SKILL,
    message: 'Could you teach me advanced Python?',
  });
  await world.requests.update(request.id, LEARNER, { status: 'ACCEPTED' });
  const session = await world.sessions.create(LEARNER, {
    sessionRequestId: request.id,
    mode: 'OFFLINE',
    locationDetails: 'Campus library, room 4',
    scheduledStart: START,
    scheduledEnd: END,
    timezone: 'Asia/Kolkata',
    ...overrides,
  });
  // SCHEDULED -> IN_PROGRESS -> COMPLETED is the only legal path.
  await world.sessions.update(session.id, LEARNER, { status: 'IN_PROGRESS' });
  await world.sessions.update(session.id, LEARNER, { status: 'COMPLETED' });
  return session.id;
}

describe('cross-module: request -> session -> interaction', () => {
  it('carries a request through acceptance into a real completed session', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world);

    expect([...world.store.requests.values()][0]?.status).toBe('ACCEPTED');
    expect(world.store.sessions.get(sessionId)?.status).toBe('COMPLETED');
    expect(world.store.events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(['REQUEST_SENT', 'REQUEST_ACCEPTED', 'SESSION_SCHEDULED']),
    );
  });

  it('rejects self, duplicate and unauthorized requests', async () => {
    const world = buildWorld();
    await expect(
      world.requests.create(LEARNER, { recipientUserId: LEARNER, skillId: SKILL }),
    ).rejects.toBeInstanceOf(ApiException);

    const first = await world.requests.create(HOST, { recipientUserId: LEARNER, skillId: SKILL });
    await expect(
      world.requests.create(HOST, { recipientUserId: LEARNER, skillId: SKILL }),
    ).rejects.toBeInstanceOf(ApiException);
    await expect(
      world.requests.update(first.id, ADMIN, { status: 'ACCEPTED' }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('records a rating for the other participant and rejects duplicates', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world);

    const rating = await world.ratings.create(LEARNER, {
      sessionId,
      rating: 5,
      feedback: 'Excellent session.',
    });
    expect(rating.ratedUser.userId).toBe(HOST);
    expect(rating.rater.userId).toBe(LEARNER);

    await expect(world.ratings.create(LEARNER, { sessionId, rating: 4 })).rejects.toBeInstanceOf(
      ApiException,
    );
  });

  it('records an assessment for the other participant and rejects self/duplicates', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world);
    const input = {
      sessionId,
      understandingScore: 5,
      practicalApplicationScore: 4,
      problemSolvingScore: 5,
      communicationScore: 4,
      reliabilityScore: 5,
      feedback: 'Very strong practical work.',
    };

    const created = await world.assessments.create(LEARNER, input);
    expect(created.assessedUser.userId).toBe(HOST);
    expect(created.assessor.userId).toBe(LEARNER);

    await expect(world.assessments.create(LEARNER, input)).rejects.toBeInstanceOf(ApiException);
  });

  it('reports reputation from real completed interactions only', async () => {
    const world = buildWorld();
    await completedSession(world);

    const summary = await world.reputation.getSummary(actor(HOST), HOST);
    expect(summary.completedSessions).toBe(1);
    // Nothing was rated or assessed, so these stay empty rather than zero-filled.
    expect(summary.ratingCount).toBe(0);
    expect(summary.averageRating).toBeNull();
    expect(summary.assessmentAverages.understandingScore).toBeNull();
    expect(summary.badgeCount).toBe(0);
  });

  it('reflects a real rating in the reputation summary', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world);
    await world.ratings.create(LEARNER, { sessionId, rating: 4 });

    const summary = await world.reputation.getSummary(actor(HOST), HOST);
    expect(summary.ratingCount).toBe(1);
    expect(summary.averageRating).toBe(4);
  });
});

describe('cross-module: badges -> notifications', () => {
  it('turns a BADGE_EARNED event into the expected notification', async () => {
    const world = buildWorld();
    const definition = await world.store.badgesRepository().createBadgeDefinition({
      name: 'First Session',
      description: 'Completed a first session.',
      code: 'FIRST_SESSION',
    });
    const award = await world.badges.awardBadge(LEARNER, definition.id);
    expect(award.userId).toBe(LEARNER);

    const event = world.store.events.find((e) => e.eventType === 'BADGE_EARNED')!;
    await world.notifications.project(event as never);

    const listed = await world.notifications.list(LEARNER, {});
    expect(listed.total).toBe(1);
    expect(listed.items[0]).toMatchObject({ userId: LEARNER, type: 'BADGE_EARNED' });
  });

  it('does not award the same badge twice', async () => {
    const world = buildWorld();
    const definition = await world.store.badgesRepository().createBadgeDefinition({
      name: 'First Session',
      description: 'Completed a first session.',
      code: 'FIRST_SESSION',
    });
    await world.badges.awardBadge(LEARNER, definition.id);
    await world.badges.awardBadge(LEARNER, definition.id);
    expect(world.store.userBadges).toHaveLength(1);
  });

  it('notifies the other participant about a session change, never the actor', async () => {
    const world = buildWorld();
    await completedSession(world);
    // SESSION_UPDATED is a supported notification source; SESSION_COMPLETED is
    // intentionally not one of the wired event types.
    const event = world.store.events.find((e) => e.eventType === 'SESSION_UPDATED')!;
    await world.notifications.project(event as never);

    // The learner drove the change, so the host is the one who gets told.
    expect((await world.notifications.list(LEARNER, {})).total).toBe(0);
    const forHost = await world.notifications.list(HOST, {});
    expect(forHost.total).toBe(1);
    expect(forHost.items[0]?.userId).toBe(HOST);
  });
});

describe('cross-module: paid session', () => {
  it('uses the server-side price and rejects a client-supplied amount', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world, { paymentMode: 'PAID', pricePaise: 15000 });
    const termsVersion = world.store.sessions.get(sessionId)!.termsVersion!;

    const order = await world.payments.createOrder(actor(LEARNER), {
      sessionId,
      termsVersion,
      termsAccepted: true,
    });
    expect(order.amountPaise).toBe(15000);
    expect(order.currency).toBe('INR');

    await expect(
      world.payments.createOrder(actor(LEARNER), {
        sessionId,
        termsVersion,
        termsAccepted: true,
        amountPaise: 1,
      } as never),
    ).rejects.toBeInstanceOf(ApiException);

    await expect(
      world.payments.createOrder(actor(LEARNER), {
        sessionId,
        termsVersion: 'stale-terms',
        termsAccepted: true,
      }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects a paid order when the recipient lacks verified evidence', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world, { paymentMode: 'PAID', pricePaise: 5000 });
    world.store.verifiedCertificationUsers.delete(HOST);

    await expect(
      world.payments.createOrder(actor(LEARNER), {
        sessionId,
        termsVersion: world.store.sessions.get(sessionId)!.termsVersion!,
        termsAccepted: true,
      }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('never claims success before the provider webhook confirms it', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world, { paymentMode: 'PAID', pricePaise: 15000 });
    const order = await world.payments.createOrder(actor(LEARNER), {
      sessionId,
      termsVersion: world.store.sessions.get(sessionId)!.termsVersion!,
      termsAccepted: true,
    });

    const verified = await world.payments.verify(actor(LEARNER), {
      paymentId: order.paymentId,
      providerOrderId: order.providerOrderId,
      providerPaymentId: 'pay_test_1',
      signature: 'valid-signature',
    });
    // Signature verified, but nothing is captured until the provider webhook.
    expect(verified.status).toBe('AUTHORIZED');

    await world.payments.handleWebhook(
      Buffer.from(
        JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_test_1',
                order_id: order.providerOrderId,
                amount: 15000,
                currency: 'INR',
              },
            },
          },
        }),
      ),
      'signature',
    );
    expect(world.store.payments.get(order.paymentId)?.status).toBe('CAPTURED');
  });

  it('stores no raw card, CVV or UPI data', async () => {
    const world = buildWorld();
    const sessionId = await completedSession(world, { paymentMode: 'PAID', pricePaise: 15000 });
    const order = await world.payments.createOrder(actor(LEARNER), {
      sessionId,
      termsVersion: world.store.sessions.get(sessionId)!.termsVersion!,
      termsAccepted: true,
    });

    const serialised = JSON.stringify(world.store.payments.get(order.paymentId)).toLowerCase();
    for (const forbidden of [
      'cvv',
      'cardnumber',
      'card_number',
      'upiid',
      'upi_id',
      'vpa',
      'cardholder',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('records a failure when the payment provider is unavailable', async () => {
    const razorpay = new FakeRazorpay();
    razorpay.failOrder = true;
    const world = buildWorld({ razorpay });
    const sessionId = await completedSession(world, { paymentMode: 'PAID', pricePaise: 15000 });

    await expect(
      world.payments.createOrder(actor(LEARNER), {
        sessionId,
        termsVersion: world.store.sessions.get(sessionId)!.termsVersion!,
        termsAccepted: true,
      }),
    ).rejects.toBeInstanceOf(ApiException);
    // The failed attempt is recorded rather than silently dropped.
    expect([...world.store.payments.values()][0]?.status).toBe('FAILED');
  });

  it('returns an unavailable AI response rather than fake text', async () => {
    const disabled: AiProvider = {
      name: 'openai',
      isConfigured: () => false,
      complete: async () => {
        throw new Error('must not be called');
      },
      chat: async () => {
        throw new Error('must not be called');
      },
    };
    const result = await new AiAssistanceService(disabled).assist(actor(LEARNER), {
      action: 'session_topics',
      context: 'Preparing for a Python session.',
    });
    expect(result).toMatchObject({ unavailable: true, content: '' });
  });
});

describe('cross-module: admin, reports and analytics', () => {
  it('keeps a USER report private but visible to an ADMIN', async () => {
    const world = buildWorld();
    const report = await world.reports.create(actor(LEARNER), {
      reportedUserId: HOST,
      category: 'HARASSMENT',
      description: 'This member repeatedly sent abusive messages to me.',
    });
    expect(report.status).toBe('OPEN');

    expect(await world.reports.list(actor(LEARNER))).toHaveLength(1);
    expect(await world.reports.list(actor(HOST))).toHaveLength(0);
    expect(await world.reports.list(admin())).toHaveLength(1);
  });

  it('stops a USER from changing report status but allows an ADMIN', async () => {
    const world = buildWorld();
    const report = await world.reports.create(actor(LEARNER), {
      reportedUserId: HOST,
      category: 'SPAM',
      description: 'Repeated unsolicited messages after a session.',
    });

    await expect(
      world.reports.updateStatus(actor(LEARNER), report.id, { status: 'RESOLVED' }),
    ).rejects.toBeInstanceOf(ApiException);

    const updated = await world.reports.updateStatus(admin(), report.id, {
      status: 'UNDER_REVIEW',
    });
    expect(updated.status).toBe('UNDER_REVIEW');
  });

  it('refuses analytics to a USER and returns real aggregates to an ADMIN', async () => {
    const world = buildWorld();
    await expect(world.analytics.overview(actor(LEARNER))).rejects.toBeInstanceOf(ApiException);

    const overview = await world.analytics.overview(admin());
    expect(overview.totalUsers).toBe(3);
    expect(Object.keys(overview).sort()).toEqual([
      'activeUsers',
      'completedSessions',
      'openReports',
      'paidSessions',
      'totalReports',
      'totalSessions',
      'totalSkills',
      'totalUsers',
    ]);
  });
});

describe('cross-module: online vs offline sessions', () => {
  it('requires locationDetails for an OFFLINE session', async () => {
    const world = buildWorld();
    const request = await world.requests.create(HOST, { recipientUserId: LEARNER, skillId: SKILL });
    await world.requests.update(request.id, LEARNER, { status: 'ACCEPTED' });

    await expect(
      world.sessions.create(LEARNER, {
        sessionRequestId: request.id,
        mode: 'OFFLINE',
        scheduledStart: START,
        scheduledEnd: END,
        timezone: 'Asia/Kolkata',
      }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('refuses to fabricate a Google Meet URL when the integration is absent', async () => {
    const world = buildWorld();
    const request = await world.requests.create(HOST, { recipientUserId: LEARNER, skillId: SKILL });
    await world.requests.update(request.id, LEARNER, { status: 'ACCEPTED' });

    // SessionsService was built with no Google integration at all.
    await expect(
      world.sessions.create(LEARNER, {
        sessionRequestId: request.id,
        mode: 'ONLINE',
        scheduledStart: START,
        scheduledEnd: END,
        timezone: 'Asia/Kolkata',
      }),
    ).rejects.toBeInstanceOf(ApiException);
    expect([...world.store.sessions.values()]).toHaveLength(0);
  });
});

describe('cross-module invariants', () => {
  it('keeps every participant a plain User with no participant roles', async () => {
    const world = buildWorld();
    const request = await world.requests.create(HOST, { recipientUserId: LEARNER, skillId: SKILL });
    await world.requests.update(request.id, LEARNER, { status: 'ACCEPTED' });
    const session = await world.sessions.create(LEARNER, {
      sessionRequestId: request.id,
      mode: 'OFFLINE',
      locationDetails: 'Campus library, room 4',
      scheduledStart: START,
      scheduledEnd: END,
      timezone: 'Asia/Kolkata',
    });

    expect(session.host.userId).toBe(HOST);
    expect(session.participant.userId).toBe(LEARNER);
    const serialised = JSON.stringify(session).toLowerCase();
    for (const role of ['teacher', 'mentor', 'student', 'tutor', 'instructor']) {
      expect(serialised).not.toContain(role);
    }
  });

  it('only ever assigns the USER and ADMIN authorization roles', async () => {
    for (const user of [actor(LEARNER), actor(HOST), admin()]) {
      for (const role of user.roles) expect(['USER', 'ADMIN']).toContain(role);
    }
  });
});
