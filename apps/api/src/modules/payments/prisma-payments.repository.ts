import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  EventEnvelope,
  PaymentEventPayload,
  RefundEventPayload,
} from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import {
  DuplicatePaymentError,
  PaymentNotFoundError,
  PaymentStateError,
  RefundError,
  type PaymentRecord,
  type PaymentSessionRecord,
  type PaymentTransactionRecord,
  type PaymentsRepository,
} from './payments.types';

const paymentInclude = {
  transactions: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.PaymentInclude;
type PaymentWithTransactions = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

@Injectable()
export class PrismaPaymentsRepository implements PaymentsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async findSession(sessionId: string): Promise<PaymentSessionRecord | null> {
    return this.prisma.learningSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        hostUserId: true,
        participantUserId: true,
        paymentMode: true,
        pricePaise: true,
        termsVersion: true,
        status: true,
      },
    });
  }

  async hasVerifiedPaidEvidence(userId: string): Promise<boolean> {
    const count = await this.prisma.certification.count({
      where: { userId, status: 'VERIFIED' },
    });
    return count > 0;
  }

  async create(
    id: string,
    session: PaymentSessionRecord,
    payerUserId: string,
    recipientUserId: string,
    termsVersion: string,
    event: EventEnvelope<PaymentEventPayload>,
  ): Promise<PaymentRecord> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            id,
            sessionId: session.id,
            payerUserId,
            recipientUserId,
            amountPaise: session.pricePaise as number,
            currency: 'INR',
            provider: 'RAZORPAY',
            status: 'CREATED',
            termsVersion,
            termsAcceptedAt: new Date(),
            termsAcceptedBy: payerUserId,
          },
          include: paymentInclude,
        });
        await this.outboxWriter.enqueue(event, tx);
        return created;
      });
      return this.mapPayment(row);
    } catch (error) {
      if (this.isDuplicate(error)) throw new DuplicatePaymentError();
      throw error;
    }
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const row = await this.prisma.payment.findUnique({ where: { id }, include: paymentInclude });
    return row ? this.mapPayment(row) : null;
  }

  async findBySessionAndPayer(
    sessionId: string,
    payerUserId: string,
  ): Promise<PaymentRecord | null> {
    const row = await this.prisma.payment.findUnique({
      where: { sessionId_payerUserId: { sessionId, payerUserId } },
      include: paymentInclude,
    });
    return row ? this.mapPayment(row) : null;
  }

  async findByProviderOrderId(providerOrderId: string): Promise<PaymentRecord | null> {
    const row = await this.prisma.payment.findUnique({
      where: { providerOrderId },
      include: paymentInclude,
    });
    return row ? this.mapPayment(row) : null;
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<PaymentRecord | null> {
    const row = await this.prisma.payment.findUnique({
      where: { providerPaymentId },
      include: paymentInclude,
    });
    return row ? this.mapPayment(row) : null;
  }

  async attachProviderOrder(id: string, providerOrderId: string): Promise<PaymentRecord> {
    const existing = await this.requirePayment(id);
    if (existing.status !== 'CREATED') throw new PaymentStateError();
    const row = await this.prisma.payment.update({
      where: { id },
      data: { providerOrderId, status: 'PENDING' },
      include: paymentInclude,
    });
    return this.mapPayment(row);
  }

  async authorize(id: string, providerPaymentId: string): Promise<PaymentRecord> {
    const existing = await this.requirePayment(id);
    if (existing.status === 'AUTHORIZED' || existing.status === 'CAPTURED') return existing;
    if (existing.status !== 'CREATED' && existing.status !== 'PENDING')
      throw new PaymentStateError();
    const row = await this.prisma.payment.update({
      where: { id },
      data: { status: 'AUTHORIZED', providerPaymentId },
      include: paymentInclude,
    });
    return this.mapPayment(row);
  }

  async capture(
    id: string,
    providerPaymentId: string,
    event: EventEnvelope<PaymentEventPayload>,
  ): Promise<PaymentRecord> {
    const existing = await this.requirePayment(id);
    if (existing.status === 'CAPTURED' && existing.providerPaymentId === providerPaymentId)
      return existing;
    if (existing.status !== 'AUTHORIZED' && existing.status !== 'PENDING')
      throw new PaymentStateError();
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: 'CAPTURED', providerPaymentId, paidAt: new Date() },
        include: paymentInclude,
      });
      await tx.transaction.create({
        data: {
          id: randomUUID(),
          paymentId: id,
          sessionId: updated.sessionId,
          userId: updated.payerUserId,
          type: 'PAYMENT',
          amountPaise: updated.amountPaise,
          currency: 'INR',
          status: 'COMPLETED',
          providerReference: providerPaymentId,
          providerEventId: event.eventId,
        },
      });
      await this.outboxWriter.enqueue(event, tx);
      return updated;
    });
    return this.mapPayment(row);
  }

  async fail(
    id: string,
    reason: string,
    event: EventEnvelope<PaymentEventPayload>,
  ): Promise<PaymentRecord> {
    const existing = await this.requirePayment(id);
    if (existing.status === 'FAILED') return existing;
    if (!['CREATED', 'PENDING', 'AUTHORIZED'].includes(existing.status)) {
      throw new PaymentStateError();
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: 'FAILED', failureReason: reason.slice(0, 1000) },
        include: paymentInclude,
      });
      await this.outboxWriter.enqueue(event, tx);
      return updated;
    });
    return this.mapPayment(row);
  }

  async requestRefund(
    id: string,
    transactionId: string,
    amountPaise: number,
    reason: string,
    event: EventEnvelope<RefundEventPayload>,
  ): Promise<PaymentRecord> {
    const existing = await this.requirePayment(id);
    const remaining = existing.amountPaise - existing.refundAmountPaise;
    if (existing.status !== 'CAPTURED' && existing.status !== 'PARTIALLY_REFUNDED') {
      throw new RefundError();
    }
    if (amountPaise <= 0 || amountPaise > remaining) throw new RefundError();
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: 'REFUND_PENDING', refundReason: reason.slice(0, 1000) },
        include: paymentInclude,
      });
      await tx.transaction.create({
        data: {
          id: transactionId,
          paymentId: id,
          sessionId: updated.sessionId,
          userId: updated.payerUserId,
          type: 'REFUND',
          amountPaise,
          currency: 'INR',
          status: 'PENDING',
          providerReference: null,
        },
      });
      await this.outboxWriter.enqueue(event, tx);
      return updated;
    });
    return this.mapPayment(row);
  }

  async completeRefund(
    id: string,
    providerRefundId: string,
    status: 'REFUNDED' | 'PARTIALLY_REFUNDED',
    event: EventEnvelope<RefundEventPayload>,
  ): Promise<PaymentRecord> {
    const existing = await this.requirePayment(id);
    if (existing.status === status) return existing;
    if (existing.status !== 'REFUND_PENDING') throw new PaymentStateError();
    const pending = await this.prisma.transaction.findFirst({
      where: { paymentId: id, type: 'REFUND', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) throw new RefundError();
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: pending.id },
        data: {
          status: 'COMPLETED',
          providerReference: providerRefundId,
          providerEventId: event.eventId,
        },
      });
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status,
          refundAmountPaise: { increment: pending.amountPaise },
          refundProviderId: providerRefundId,
          refundedAt: new Date(),
        },
        include: paymentInclude,
      });
      await this.outboxWriter.enqueue(event, tx);
      return updated;
    });
    return this.mapPayment(row);
  }

  async pendingRefundTransactionId(paymentId: string): Promise<string | null> {
    const pending = await this.prisma.transaction.findFirst({
      where: { paymentId, type: 'REFUND', status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return pending?.id ?? null;
  }

  async hasProcessedProviderEvent(providerEventId: string): Promise<boolean> {
    return (
      (await this.prisma.transaction.findUnique({
        where: { providerEventId },
        select: { id: true },
      })) !== null
    );
  }

  async listHistory(userId: string, includeAll: boolean): Promise<PaymentRecord[]> {
    const rows = await this.prisma.payment.findMany({
      where: includeAll ? {} : { OR: [{ payerUserId: userId }, { recipientUserId: userId }] },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapPayment(row));
  }

  private async requirePayment(id: string): Promise<PaymentRecord> {
    const payment = await this.findById(id);
    if (!payment) throw new PaymentNotFoundError();
    return payment;
  }

  private mapPayment(row: PaymentWithTransactions): PaymentRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      payerUserId: row.payerUserId,
      recipientUserId: row.recipientUserId,
      amountPaise: row.amountPaise,
      currency: 'INR',
      provider: 'RAZORPAY',
      providerOrderId: row.providerOrderId,
      providerPaymentId: row.providerPaymentId,
      status: row.status as PaymentRecord['status'],
      termsVersion: row.termsVersion,
      termsAcceptedAt: row.termsAcceptedAt,
      termsAcceptedBy: row.termsAcceptedBy,
      paidAt: row.paidAt,
      failureReason: row.failureReason,
      refundAmountPaise: row.refundAmountPaise,
      refundProviderId: row.refundProviderId,
      refundReason: row.refundReason,
      refundedAt: row.refundedAt,
      transactions: row.transactions.map((transaction) => ({
        id: transaction.id,
        paymentId: transaction.paymentId,
        sessionId: transaction.sessionId,
        userId: transaction.userId,
        type: transaction.type as PaymentTransactionRecord['type'],
        amountPaise: transaction.amountPaise,
        currency: 'INR',
        status: transaction.status as PaymentTransactionRecord['status'],
        providerReference: transaction.providerReference,
        createdAt: transaction.createdAt,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private isDuplicate(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
