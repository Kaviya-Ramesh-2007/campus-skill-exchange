import { describe, expect, it, vi } from 'vitest';
import { PrismaPaymentsRepository } from '../src/modules/payments/prisma-payments.repository';
import { RefundError, type PaymentSessionRecord } from '../src/modules/payments/payments.types';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type {
  EventEnvelope,
  PaymentEventPayload,
  RefundEventPayload,
} from '@campus-skill-exchange/contracts';

const paymentId = '00000000-0000-4000-8000-000000000001';
const sessionId = '00000000-0000-4000-8000-000000000002';
const payerId = '00000000-0000-4000-8000-000000000003';
const recipientId = '00000000-0000-4000-8000-000000000004';
const now = new Date('2026-10-01T12:00:00.000Z');
const row = {
  id: paymentId,
  sessionId,
  payerUserId: payerId,
  recipientUserId: recipientId,
  amountPaise: 10000,
  currency: 'INR',
  provider: 'RAZORPAY',
  providerOrderId: null,
  providerPaymentId: null,
  status: 'CREATED',
  termsVersion: '2026-10-01',
  termsAcceptedAt: now,
  termsAcceptedBy: payerId,
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
const session: PaymentSessionRecord = {
  id: sessionId,
  hostUserId: recipientId,
  participantUserId: payerId,
  paymentMode: 'PAID',
  pricePaise: 10000,
  termsVersion: '2026-10-01',
  status: 'SCHEDULED',
};
const event = {
  eventId: '00000000-0000-4000-8000-000000000005',
  eventType: 'PAYMENT_CAPTURED',
  version: 1,
  occurredAt: now.toISOString(),
  actorId: payerId,
  entityType: 'Payment',
  entityId: paymentId,
  correlationId: null,
  causationId: null,
  idempotencyKey: 'payment-captured',
  payload: {
    paymentId,
    sessionId,
    payerUserId: payerId,
    recipientUserId: recipientId,
    amountPaise: 10000,
    currency: 'INR',
    status: 'CAPTURED',
  },
} as EventEnvelope<PaymentEventPayload>;

function setup(status = 'CREATED') {
  const current = { ...row, status };
  const tx = {
    payment: {
      create: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue({ ...current, status: 'CAPTURED' }),
    },
    transaction: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue({ id: 'tx-1', amountPaise: 5000 }),
    },
  };
  const payment = {
    findUnique: vi.fn().mockResolvedValue(current),
    create: vi.fn().mockResolvedValue(current),
  };
  const transaction = { findUnique: vi.fn().mockResolvedValue(null) };
  const prisma = {
    payment,
    transaction,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaService;
  const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const repository = new PrismaPaymentsRepository(prisma, outbox);
  return { repository, tx, payment, outbox };
}

describe('PrismaPaymentsRepository', () => {
  it('stores INR paise and emits the created event transactionally', async () => {
    const { repository, tx, outbox } = setup();
    await repository.create(paymentId, session, payerId, recipientId, '2026-10-01', event);
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: 10000,
          currency: 'INR',
          provider: 'RAZORPAY',
          termsAcceptedBy: payerId,
        }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(event, tx);
  });

  it('records a captured payment transaction and enforces capture state', async () => {
    const { repository, tx, outbox } = setup('AUTHORIZED');
    await repository.capture(paymentId, 'pay_test', event);
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'PAYMENT', status: 'COMPLETED', amountPaise: 10000 }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(event, tx);
  });

  it('rejects invalid and duplicate refund requests', async () => {
    const { repository, tx, payment } = setup('CAPTURED');
    const refundEvent = {
      ...event,
      payload: { ...event.payload, status: 'REFUND_PENDING' },
    } as EventEnvelope<RefundEventPayload>;
    payment.findUnique
      .mockResolvedValueOnce({ ...row, status: 'CAPTURED' })
      .mockResolvedValueOnce({ ...row, status: 'CAPTURED' })
      .mockResolvedValueOnce({ ...row, status: 'REFUND_PENDING' });
    await expect(
      repository.requestRefund(paymentId, 'tx-1', 10001, 'Too much', refundEvent),
    ).rejects.toBeInstanceOf(RefundError);
    await repository.requestRefund(paymentId, 'tx-2', 5000, 'Cancelled', refundEvent);
    await expect(
      repository.requestRefund(paymentId, 'tx-3', 1000, 'Again', refundEvent),
    ).rejects.toBeInstanceOf(RefundError);
    expect(tx.transaction.create).toHaveBeenCalled();
  });
});
