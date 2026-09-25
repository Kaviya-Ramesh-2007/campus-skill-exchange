import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';
import { PaymentsService } from '../src/modules/payments/payments.service';
import {
  DuplicatePaymentError,
  type PaymentRecord,
  type PaymentSessionRecord,
  type PaymentsRepository,
} from '../src/modules/payments/payments.types';
import type { RazorpayProvider } from '../src/modules/payments/razorpay.provider';
import type {
  AuthUser,
  EventEnvelope,
  PaymentEventPayload,
  RefundEventPayload,
} from '@campus-skill-exchange/contracts';

const payerId = '00000000-0000-4000-8000-000000000001';
const recipientId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const sessionId = '00000000-0000-4000-8000-000000000004';
const paymentId = '00000000-0000-4000-8000-000000000005';
const now = new Date('2026-10-01T12:00:00.000Z');
const payer: AuthUser = {
  id: payerId,
  email: 'payer@example.test',
  displayName: 'Payer',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: now.toISOString(),
};

class FakeProvider implements RazorpayProvider {
  refundStatus = 'processed';
  getPublicKeyId() {
    return 'rzp_test_public';
  }
  async createOrder() {
    return { id: 'order_test_1', amount: 10000, currency: 'INR' };
  }
  verifyPaymentSignature(input: { signature: string }) {
    return input.signature === 'valid-signature';
  }
  verifyWebhookSignature() {
    return true;
  }
  async createRefund() {
    return { id: 'rfnd_test_1', status: this.refundStatus };
  }
}

class FakePaymentsRepository implements PaymentsRepository {
  session: PaymentSessionRecord = {
    id: sessionId,
    hostUserId: recipientId,
    participantUserId: payerId,
    paymentMode: 'PAID',
    pricePaise: 10000,
    termsVersion: '2026-10-01',
    status: 'SCHEDULED',
  };
  eligible = true;
  payment: PaymentRecord | null = null;
  events: EventEnvelope<PaymentEventPayload | RefundEventPayload>[] = [];
  processedEvents = new Set<string>();
  private pendingRefundId: string | null = null;

  async findSession() {
    return this.session;
  }
  async existsForSession() {
    return this.payment !== null;
  }
  async hasVerifiedPaidEvidence() {
    return this.eligible;
  }
  async findBySessionAndPayer() {
    return this.payment;
  }
  async findById() {
    return this.payment;
  }
  async findByProviderOrderId() {
    return this.payment?.providerOrderId === 'order_test_1' ? this.payment : null;
  }
  async findByProviderPaymentId() {
    return this.payment?.providerPaymentId === 'pay_test_1' ? this.payment : null;
  }
  async create(
    id: string,
    session: PaymentSessionRecord,
    payerUserId: string,
    recipientUserId: string,
    termsVersion: string,
    event: EventEnvelope<PaymentEventPayload>,
  ) {
    if (this.payment) throw new DuplicatePaymentError();
    this.payment = {
      id,
      sessionId: session.id,
      payerUserId,
      recipientUserId,
      amountPaise: session.pricePaise as number,
      currency: 'INR',
      provider: 'RAZORPAY',
      providerOrderId: null,
      providerPaymentId: null,
      status: 'CREATED',
      termsVersion,
      termsAcceptedAt: now,
      termsAcceptedBy: payerUserId,
      paidAt: null,
      failureReason: null,
      refundAmountPaise: 0,
      refundProviderId: null,
      refundReason: null,
      refundedAt: null,
      transactions: [],
      createdAt: now,
      updatedAt: now,
    };
    this.events.push(event);
    return this.payment;
  }
  async attachProviderOrder() {
    if (!this.payment) throw new Error('missing payment');
    this.payment = { ...this.payment, providerOrderId: 'order_test_1', status: 'PENDING' };
    return this.payment;
  }
  async authorize(_id: string, providerPaymentId: string) {
    if (!this.payment) throw new Error('missing payment');
    this.payment = { ...this.payment, providerPaymentId, status: 'AUTHORIZED' };
    return this.payment;
  }
  async capture(_id: string, providerPaymentId: string, event: EventEnvelope<PaymentEventPayload>) {
    if (!this.payment) throw new Error('missing payment');
    this.payment = { ...this.payment, providerPaymentId, status: 'CAPTURED', paidAt: now };
    this.events.push(event);
    this.processedEvents.add(event.eventId);
    return this.payment;
  }
  async fail(_id: string, reason: string, event: EventEnvelope<PaymentEventPayload>) {
    if (!this.payment) throw new Error('missing payment');
    this.payment = { ...this.payment, status: 'FAILED', failureReason: reason };
    this.events.push(event);
    return this.payment;
  }
  async requestRefund(
    _id: string,
    transactionId: string,
    _amountPaise: number,
    reason: string,
    event: EventEnvelope<RefundEventPayload>,
  ) {
    if (!this.payment) throw new Error('missing payment');
    this.payment = { ...this.payment, status: 'REFUND_PENDING', refundReason: reason };
    this.pendingRefundId = transactionId;
    this.events.push(event);
    return this.payment;
  }
  async completeRefund(
    _id: string,
    providerRefundId: string,
    status: 'REFUNDED' | 'PARTIALLY_REFUNDED',
    event: EventEnvelope<RefundEventPayload>,
  ) {
    if (!this.payment) throw new Error('missing payment');
    const amount = event.payload.amountPaise;
    this.payment = {
      ...this.payment,
      status,
      refundProviderId: providerRefundId,
      refundAmountPaise: this.payment.refundAmountPaise + amount,
      refundedAt: now,
    };
    this.pendingRefundId = null;
    this.events.push(event);
    return this.payment;
  }
  async pendingRefundTransactionId() {
    return this.pendingRefundId;
  }
  async hasProcessedProviderEvent(id: string) {
    return this.processedEvents.has(id);
  }
  async listHistory(userId: string, includeAll: boolean) {
    if (
      includeAll ||
      this.payment?.payerUserId === userId ||
      this.payment?.recipientUserId === userId
    ) {
      return this.payment ? [this.payment] : [];
    }
    return [];
  }
}

function setup() {
  const repository = new FakePaymentsRepository();
  const provider = new FakeProvider();
  const service = new PaymentsService(repository, provider, new SystemRoleAuthorizationPolicy());
  return { repository, provider, service };
}

describe('PaymentsService', () => {
  it('rejects FREE sessions and requires accepted current terms', async () => {
    const { repository, service } = setup();
    repository.session.paymentMode = 'FREE';
    await expect(
      service.createOrder(payer, { sessionId, termsVersion: '2026-10-01', termsAccepted: true }),
    ).rejects.toBeTruthy();

    repository.session.paymentMode = 'PAID';
    await expect(
      service.createOrder(payer, { sessionId, termsVersion: '2026-10-01', termsAccepted: false }),
    ).rejects.toBeTruthy();
    await expect(
      service.createOrder(payer, { sessionId, termsVersion: 'old', termsAccepted: true }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('enforces verified paid-session eligibility and authoritative INR pricing', async () => {
    const { repository, service } = setup();
    repository.eligible = false;
    await expect(
      service.createOrder(payer, { sessionId, termsVersion: '2026-10-01', termsAccepted: true }),
    ).rejects.toBeInstanceOf(ApiException);

    repository.eligible = true;
    await expect(
      service.createOrder(payer, {
        sessionId,
        termsVersion: '2026-10-01',
        termsAccepted: true,
        amountPaise: 1,
      } as never),
    ).rejects.toBeInstanceOf(ApiException);
    const order = await service.createOrder(payer, {
      sessionId,
      termsVersion: '2026-10-01',
      termsAccepted: true,
    });
    expect(order.amountPaise).toBe(10000);
    expect(order.currency).toBe('INR');
    expect(repository.events[0]).toMatchObject({ eventType: 'PAYMENT_CREATED' });
  });

  it('is idempotent for duplicate orders and rejects invalid payment signatures', async () => {
    const { repository, service } = setup();
    const first = await service.createOrder(payer, {
      sessionId,
      termsVersion: '2026-10-01',
      termsAccepted: true,
    });
    const duplicate = await service.createOrder(payer, {
      sessionId,
      termsVersion: '2026-10-01',
      termsAccepted: true,
    });
    expect(duplicate.providerOrderId).toBe(first.providerOrderId);
    expect(repository.events).toHaveLength(1);

    await expect(
      service.verify(payer, {
        paymentId,
        providerOrderId: 'order_test_1',
        providerPaymentId: 'pay_test_1',
        signature: 'bad',
      }),
    ).rejects.toBeTruthy();
    await expect(
      service.verify(payer, {
        paymentId,
        providerOrderId: 'order_test_1',
        providerPaymentId: 'pay_test_1',
        signature: 'valid-signature',
      }),
    ).resolves.toMatchObject({ status: 'AUTHORIZED' });
  });

  it('processes signed capture webhooks idempotently', async () => {
    const { repository, service } = setup();
    await service.createOrder(payer, {
      sessionId,
      termsVersion: '2026-10-01',
      termsAccepted: true,
    });
    const body = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_test_1', order_id: 'order_test_1', amount: 10000, currency: 'INR' },
          },
        },
      }),
    );
    await service.handleWebhook(body, 'signature');
    const duplicate = await service.handleWebhook(body, 'signature');
    expect(duplicate.duplicate).toBe(true);
    expect(repository.payment?.status).toBe('CAPTURED');
  });

  it('never trusts a provider amount that differs from the server-side price', async () => {
    const { repository, service } = setup();
    await service.createOrder(payer, {
      sessionId,
      termsVersion: '2026-10-01',
      termsAccepted: true,
    });
    const tampered = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_tampered', order_id: 'order_test_1', amount: 100, currency: 'INR' },
          },
        },
      }),
    );
    await service.handleWebhook(tampered, 'signature');
    expect(repository.payment?.status).toBe('PENDING');
    expect(repository.payment?.paidAt).toBeNull();
  });

  it('restricts history and refunds to the payer or ADMIN', async () => {
    const { repository, service } = setup();
    await service.createOrder(payer, {
      sessionId,
      termsVersion: '2026-10-01',
      termsAccepted: true,
    });
    await expect(service.history({ ...payer, id: otherId })).resolves.toEqual([]);
    repository.session.status = 'CANCELLED';
    await expect(
      service.requestRefund({ ...payer, id: otherId }, paymentId, { reason: 'Cancelled' }),
    ).rejects.toBeTruthy();
  });

  it('prevents excess or duplicate refunds and uses real provider results', async () => {
    const { repository, provider, service } = setup();
    await service.createOrder(payer, {
      sessionId,
      termsVersion: '2026-10-01',
      termsAccepted: true,
    });
    repository.session.status = 'CANCELLED';
    await service.handleWebhook(
      Buffer.from(
        JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_test_1',
                order_id: 'order_test_1',
                amount: 10000,
                currency: 'INR',
              },
            },
          },
        }),
      ),
      'signature',
    );
    await expect(
      service.requestRefund(payer, paymentId, { amountPaise: 10001, reason: 'Too much' }),
    ).rejects.toBeInstanceOf(ApiException);

    provider.refundStatus = 'pending';
    await expect(
      service.requestRefund(payer, paymentId, { amountPaise: 5000, reason: 'Cancelled' }),
    ).resolves.toMatchObject({ status: 'REFUND_PENDING' });
  });
});
