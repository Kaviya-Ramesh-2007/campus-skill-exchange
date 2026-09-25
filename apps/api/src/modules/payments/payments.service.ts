import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  createPaymentOrderSchema,
  idSchema,
  paymentCapturedEventDefinition,
  paymentCreatedEventDefinition,
  paymentFailedEventDefinition,
  paymentOrderResponseSchema,
  refundCompletedEventDefinition,
  refundPaymentSchema,
  refundRequestedEventDefinition,
  verifyPaymentSchema,
  type AuthUser,
  type EventEnvelope,
  type Payment,
  type PaymentEventPayload,
  type PaymentOrderResponse,
  type RefundEventPayload,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AUTHORIZATION_POLICY, type AuthorizationPolicy } from '../../platform/auth/auth-contracts';
import {
  DuplicatePaymentError,
  PAYMENTS_REPOSITORY,
  PaymentAmountError,
  PaymentEligibilityError,
  PaymentNotFoundError,
  PaymentStateError,
  PaymentTermsError,
  RefundError,
  type PaymentRecord,
  type PaymentSessionRecord,
  type PaymentsRepository,
} from './payments.types';
import {
  RAZORPAY_PROVIDER,
  RazorpayProviderError,
  type RazorpayProvider,
} from './razorpay.provider';

interface WebhookPayload {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY) private readonly repository: PaymentsRepository,
    @Inject(RAZORPAY_PROVIDER) private readonly razorpay: RazorpayProvider,
    @Inject(AUTHORIZATION_POLICY) private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async createOrder(actor: AuthUser, input: unknown): Promise<PaymentOrderResponse> {
    try {
      return await this.createOrderInternal(actor, input);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private async createOrderInternal(
    actor: AuthUser,
    input: unknown,
  ): Promise<PaymentOrderResponse> {
    const data = this.parse(createPaymentOrderSchema, input);
    const session = await this.requireParticipantSession(data.sessionId, actor.id);
    this.assertPaidSession(session);
    if (data.termsVersion !== session.termsVersion) throw new PaymentTermsError();
    const recipientUserId = this.otherParticipant(session, actor.id);
    if (!(await this.repository.hasVerifiedPaidEvidence(recipientUserId))) {
      throw new PaymentEligibilityError();
    }

    const existing = await this.repository.findBySessionAndPayer(session.id, actor.id);
    if (existing) {
      if (existing.providerOrderId && ['CREATED', 'PENDING'].includes(existing.status)) {
        return this.toOrderResponse(existing);
      }
      throw new DuplicatePaymentError();
    }

    const id = randomUUID();
    const created = await this.repository.create(
      id,
      session,
      actor.id,
      recipientUserId,
      data.termsVersion,
      this.paymentEvent(
        createdEvent(),
        id,
        session.id,
        actor.id,
        recipientUserId,
        session.pricePaise as number,
        'CREATED',
      ),
    );
    try {
      const order = await this.razorpay.createOrder({
        paymentId: id,
        amountPaise: created.amountPaise,
      });
      const payment = await this.repository.attachProviderOrder(id, order.id);
      return this.toOrderResponse(payment, order.id);
    } catch (error) {
      await this.repository.fail(
        id,
        'Razorpay order creation failed.',
        this.paymentEvent(
          paymentFailedEventDefinition,
          id,
          session.id,
          actor.id,
          recipientUserId,
          created.amountPaise,
          'FAILED',
        ),
      );
      if (error instanceof RazorpayProviderError) {
        throw new ApiException(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Payment service is temporarily unavailable.',
        );
      }
      throw error;
    }
  }

  async verify(actor: AuthUser, input: unknown): Promise<Payment> {
    try {
      return await this.verifyInternal(actor, input);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private async verifyInternal(actor: AuthUser, input: unknown): Promise<Payment> {
    const data = this.parse(verifyPaymentSchema, input);
    const payment = await this.requirePayment(data.paymentId);
    this.assertCanAccess(actor, payment);
    if (payment.providerOrderId !== data.providerOrderId || payment.status === 'FAILED') {
      throw new ApiException(409, 'CONFLICT', 'The payment cannot be verified.');
    }
    if (
      !this.razorpay.verifyPaymentSignature({
        orderId: data.providerOrderId,
        paymentId: data.providerPaymentId,
        signature: data.signature,
      })
    ) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'The payment signature is invalid.');
    }
    return this.toResponse(await this.repository.authorize(payment.id, data.providerPaymentId));
  }

  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true; duplicate?: boolean }> {
    try {
      return await this.handleWebhookInternal(rawBody, signature);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private async handleWebhookInternal(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: true; duplicate?: boolean }> {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'The webhook signature is invalid.');
    }
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
    } catch {
      throw new ApiException(400, 'VALIDATION_ERROR', 'The webhook payload is invalid.');
    }
    const eventId = this.webhookEventId(payload);
    if (eventId && (await this.repository.hasProcessedProviderEvent(eventId))) {
      return { received: true, duplicate: true };
    }
    if (payload.event === 'payment.captured') {
      const entity = payload.payload?.payment?.entity;
      const payment = entity?.order_id
        ? await this.repository.findByProviderOrderId(entity.order_id)
        : null;
      if (
        payment &&
        entity?.id &&
        entity.amount === payment.amountPaise &&
        entity.currency === 'INR'
      ) {
        await this.repository.capture(
          payment.id,
          entity.id,
          this.paymentEvent(
            paymentCapturedEventDefinition,
            payment.id,
            payment.sessionId,
            payment.payerUserId,
            payment.recipientUserId,
            payment.amountPaise,
            'CAPTURED',
            eventId,
          ),
        );
      }
    } else if (payload.event === 'payment.failed') {
      const entity = payload.payload?.payment?.entity;
      const payment = entity?.order_id
        ? await this.repository.findByProviderOrderId(entity.order_id)
        : null;
      if (payment) {
        await this.repository.fail(
          payment.id,
          'Razorpay reported a failed payment.',
          this.paymentEvent(
            paymentFailedEventDefinition,
            payment.id,
            payment.sessionId,
            payment.payerUserId,
            payment.recipientUserId,
            payment.amountPaise,
            'FAILED',
            eventId,
          ),
        );
      }
    } else if (payload.event === 'refund.processed') {
      const entity = payload.payload?.refund?.entity;
      const payment = entity?.payment_id
        ? await this.repository.findByProviderPaymentId(entity.payment_id)
        : null;
      if (payment && entity?.id) {
        const status =
          (entity.amount ?? 0) >= payment.amountPaise ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        const transactionId = await this.repository.pendingRefundTransactionId(payment.id);
        const event = this.refundEvent(
          refundCompletedEventDefinition,
          payment,
          'REFUND_COMPLETED',
          entity.id,
          null,
          entity.amount ?? payment.amountPaise,
          transactionId ?? undefined,
          eventId,
        );
        await this.repository.completeRefund(payment.id, entity.id, status, event);
      }
    }
    return { received: true };
  }

  async history(actor: AuthUser): Promise<Payment[]> {
    const rows = await this.repository.listHistory(actor.id, actor.roles.includes('ADMIN'));
    return rows.map((row) => this.toResponse(row));
  }

  async get(actor: AuthUser, paymentId: string): Promise<Payment> {
    this.assertUuid(paymentId, 'paymentId');
    const payment = await this.requirePayment(paymentId);
    this.assertCanAccess(actor, payment);
    return this.toResponse(payment);
  }

  async requestRefund(actor: AuthUser, paymentId: string, input: unknown): Promise<Payment> {
    try {
      return await this.requestRefundInternal(actor, paymentId, input);
    } catch (error) {
      this.rethrow(error);
    }
  }

  private async requestRefundInternal(
    actor: AuthUser,
    paymentId: string,
    input: unknown,
  ): Promise<Payment> {
    this.assertUuid(paymentId, 'paymentId');
    const data = this.parse(refundPaymentSchema, input);
    const payment = await this.requirePayment(paymentId);
    this.assertPayerOrAdmin(actor, payment);
    if (!payment.providerPaymentId) throw new RefundError();
    const session = await this.repository.findSession(payment.sessionId);
    if (
      !session ||
      (!actor.roles.includes('ADMIN') && !['CANCELLED', 'NO_SHOW'].includes(session.status))
    ) {
      throw new RefundError();
    }
    const remaining = payment.amountPaise - payment.refundAmountPaise;
    const amount = data.amountPaise ?? remaining;
    if (amount <= 0 || amount > remaining) throw new RefundError();
    const transactionId = randomUUID();
    const pending = await this.repository.requestRefund(
      payment.id,
      transactionId,
      amount,
      data.reason,
      this.refundEvent(
        refundRequestedEventDefinition,
        payment,
        'REFUND_REQUESTED',
        null,
        data.reason,
        amount,
        transactionId,
      ),
    );
    try {
      const refund = await this.razorpay.createRefund({
        paymentId: payment.providerPaymentId,
        amountPaise: amount,
      });
      if (!['processed', 'completed', 'succeeded'].includes(refund.status.toLowerCase())) {
        return this.toResponse(pending);
      }
      const status = refundAmountIsFull(payment, amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      const pendingTransactionId = await this.repository.pendingRefundTransactionId(payment.id);
      const completed = await this.repository.completeRefund(
        payment.id,
        refund.id,
        status,
        this.refundEvent(
          refundCompletedEventDefinition,
          payment,
          'REFUND_COMPLETED',
          refund.id,
          data.reason,
          amount,
          pendingTransactionId ?? undefined,
        ),
      );
      return this.toResponse(completed);
    } catch (error) {
      if (error instanceof RazorpayProviderError) {
        throw new ApiException(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Refund service is temporarily unavailable.',
        );
      }
      throw error;
    }
  }

  private async requireParticipantSession(
    sessionId: string,
    userId: string,
  ): Promise<PaymentSessionRecord> {
    const session = await this.repository.findSession(sessionId);
    if (!session) throw new ApiException(404, 'NOT_FOUND', 'The session was not found.');
    this.assertParticipant(session, userId);
    return session;
  }

  private async requirePayment(id: string): Promise<PaymentRecord> {
    const payment = await this.repository.findById(id);
    if (!payment) throw new ApiException(404, 'NOT_FOUND', 'The payment was not found.');
    return payment;
  }

  private assertParticipant(session: PaymentSessionRecord, userId: string): void {
    if (session.hostUserId !== userId && session.participantUserId !== userId) {
      throw new ApiException(
        403,
        'FORBIDDEN',
        'Only Session participants can pay for this Session.',
      );
    }
  }

  private otherParticipant(session: PaymentSessionRecord, userId: string): string {
    if (session.hostUserId === userId) return session.participantUserId;
    if (session.participantUserId === userId) return session.hostUserId;
    throw new ApiException(403, 'FORBIDDEN', 'Only Session participants can pay for this Session.');
  }

  private assertPaidSession(session: PaymentSessionRecord): void {
    if (
      session.paymentMode !== 'PAID' ||
      !Number.isInteger(session.pricePaise) ||
      (session.pricePaise ?? 0) <= 0
    ) {
      throw new PaymentAmountError();
    }
    if (!session.termsVersion) throw new PaymentTermsError();
  }

  private assertCanAccess(actor: AuthUser, payment: PaymentRecord): void {
    if (
      actor.roles.includes('ADMIN') ||
      payment.payerUserId === actor.id ||
      payment.recipientUserId === actor.id
    )
      return;
    throw new ApiException(403, 'AUTH_FORBIDDEN', 'You cannot access this payment.');
  }

  private assertPayerOrAdmin(actor: AuthUser, payment: PaymentRecord): void {
    if (actor.roles.includes('ADMIN') || payment.payerUserId === actor.id) return;
    throw new ApiException(
      403,
      'AUTH_FORBIDDEN',
      'Only the payer or an ADMIN can request a refund.',
    );
  }

  private assertUuid(value: string, field: string): void {
    if (idSchema.safeParse(value).success) return;
    throw new ApiException(400, 'VALIDATION_ERROR', `${field} must be a valid UUID.`);
  }

  private paymentEvent(
    definition: { name: string; version: number },
    paymentId: string,
    sessionId: string,
    payerUserId: string,
    recipientUserId: string,
    amountPaise: number,
    status: PaymentEventPayload['status'],
    eventId: string = randomUUID(),
  ): EventEnvelope<PaymentEventPayload> {
    return {
      eventId,
      eventType: definition.name,
      version: definition.version,
      occurredAt: new Date().toISOString(),
      actorId: payerUserId,
      entityType: 'Payment',
      entityId: paymentId,
      correlationId: null,
      causationId: null,
      idempotencyKey: `${definition.name.toLowerCase()}:${paymentId}:${eventId}`,
      payload: {
        paymentId,
        sessionId,
        payerUserId,
        recipientUserId,
        amountPaise,
        currency: 'INR',
        status,
      },
    };
  }

  private refundEvent(
    definition: { name: string; version: number },
    payment: PaymentRecord,
    _name: string,
    refundProviderId: string | null,
    reason: string | null,
    amountPaise = payment.amountPaise,
    transactionId: string = randomUUID(),
    eventId: string = randomUUID(),
  ): EventEnvelope<RefundEventPayload> {
    return {
      eventId,
      eventType: definition.name,
      version: definition.version,
      occurredAt: new Date().toISOString(),
      actorId: payment.payerUserId,
      entityType: 'Payment',
      entityId: payment.id,
      correlationId: null,
      causationId: null,
      idempotencyKey: `${definition.name.toLowerCase()}:${payment.id}:${randomUUID()}`,
      payload: {
        paymentId: payment.id,
        sessionId: payment.sessionId,
        payerUserId: payment.payerUserId,
        recipientUserId: payment.recipientUserId,
        amountPaise,
        currency: 'INR',
        status: definition === refundCompletedEventDefinition ? 'REFUNDED' : 'REFUND_PENDING',
        transactionId,
        refundProviderId,
        reason,
      },
    };
  }

  private toOrderResponse(
    payment: PaymentRecord,
    providerOrderId = payment.providerOrderId,
  ): PaymentOrderResponse {
    if (!providerOrderId)
      throw new ApiException(409, 'CONFLICT', 'The payment order is not ready.');
    return paymentOrderResponseSchema.parse({
      paymentId: payment.id,
      providerOrderId,
      amountPaise: payment.amountPaise,
      currency: 'INR',
      keyId: this.razorpay.getPublicKeyId(),
    });
  }

  private toResponse(record: PaymentRecord): Payment {
    return {
      ...record,
      termsAcceptedAt: record.termsAcceptedAt.toISOString(),
      paidAt: record.paidAt?.toISOString() ?? null,
      refundedAt: record.refundedAt?.toISOString() ?? null,
      transactions: record.transactions.map((transaction) => ({
        ...transaction,
        createdAt: transaction.createdAt.toISOString(),
      })),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private webhookEventId(payload: WebhookPayload): string {
    const entity = payload.payload?.payment?.entity?.id ?? payload.payload?.refund?.entity?.id;
    return entity ? `${payload.event ?? 'webhook'}:${entity}` : '';
  }

  private rethrow(error: unknown): never {
    if (error instanceof PaymentTermsError) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'The paid Session terms must be accepted.');
    }
    if (error instanceof PaymentAmountError) {
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'The Session price is not a valid INR amount.',
      );
    }
    if (error instanceof PaymentEligibilityError) {
      throw new ApiException(
        403,
        'FORBIDDEN',
        'The recipient is not eligible to offer a paid Session.',
      );
    }
    if (error instanceof PaymentNotFoundError) {
      throw new ApiException(404, 'NOT_FOUND', 'The payment was not found.');
    }
    if (error instanceof DuplicatePaymentError || error instanceof PaymentStateError) {
      throw new ApiException(
        409,
        'CONFLICT',
        'The payment cannot be changed in its current state.',
      );
    }
    if (error instanceof RefundError) {
      throw new ApiException(409, 'CONFLICT', 'The refund request is not allowed.');
    }
    if (error instanceof RazorpayProviderError) {
      throw new ApiException(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Payment service is temporarily unavailable.',
      );
    }
    throw error;
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success || result.data === undefined) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    }
    return result.data;
  }
}

function refundAmountIsFull(payment: PaymentRecord, amountPaise: number): boolean {
  return payment.refundAmountPaise + amountPaise >= payment.amountPaise;
}

function createdEvent() {
  return paymentCreatedEventDefinition;
}
