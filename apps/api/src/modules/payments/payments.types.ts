import type {
  EventEnvelope,
  Payment,
  PaymentEventPayload,
  RefundEventPayload,
} from '@campus-skill-exchange/contracts';

export const PAYMENTS_REPOSITORY = Symbol('PAYMENTS_REPOSITORY');

export interface PaymentTransactionRecord {
  id: string;
  paymentId: string;
  sessionId: string;
  userId: string;
  type: 'PAYMENT' | 'REFUND';
  amountPaise: number;
  currency: 'INR';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  providerReference: string | null;
  createdAt: Date;
}
export interface PaymentRecord {
  id: string;
  sessionId: string;
  payerUserId: string;
  recipientUserId: string;
  amountPaise: number;
  currency: 'INR';
  provider: 'RAZORPAY';
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: Payment['status'];
  termsVersion: string;
  termsAcceptedAt: Date;
  termsAcceptedBy: string;
  paidAt: Date | null;
  failureReason: string | null;
  refundAmountPaise: number;
  refundProviderId: string | null;
  refundReason: string | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  transactions: PaymentTransactionRecord[];
}
export interface PaymentSessionRecord {
  id: string;
  hostUserId: string;
  participantUserId: string;
  paymentMode: 'FREE' | 'PAID';
  pricePaise: number | null;
  termsVersion: string | null;
  status: string;
}
export interface PaymentsRepository {
  findSession(sessionId: string): Promise<PaymentSessionRecord | null>;
  hasVerifiedPaidEvidence(userId: string): Promise<boolean>;
  create(
    id: string,
    session: PaymentSessionRecord,
    payerUserId: string,
    recipientUserId: string,
    termsVersion: string,
    event: EventEnvelope<PaymentEventPayload>,
  ): Promise<PaymentRecord>;
  findById(id: string): Promise<PaymentRecord | null>;
  findBySessionAndPayer(sessionId: string, payerUserId: string): Promise<PaymentRecord | null>;
  findByProviderOrderId(providerOrderId: string): Promise<PaymentRecord | null>;
  findByProviderPaymentId(providerPaymentId: string): Promise<PaymentRecord | null>;
  attachProviderOrder(id: string, providerOrderId: string): Promise<PaymentRecord>;
  authorize(id: string, providerPaymentId: string): Promise<PaymentRecord>;
  capture(
    id: string,
    providerPaymentId: string,
    event: EventEnvelope<PaymentEventPayload>,
  ): Promise<PaymentRecord>;
  fail(
    id: string,
    reason: string,
    event: EventEnvelope<PaymentEventPayload>,
  ): Promise<PaymentRecord>;
  requestRefund(
    id: string,
    transactionId: string,
    amountPaise: number,
    reason: string,
    event: EventEnvelope<RefundEventPayload>,
  ): Promise<PaymentRecord>;
  completeRefund(
    id: string,
    providerRefundId: string,
    status: 'REFUNDED' | 'PARTIALLY_REFUNDED',
    event: EventEnvelope<RefundEventPayload>,
  ): Promise<PaymentRecord>;
  pendingRefundTransactionId(paymentId: string): Promise<string | null>;
  hasProcessedProviderEvent(providerEventId: string): Promise<boolean>;
  listHistory(userId: string, includeAll: boolean): Promise<PaymentRecord[]>;
}

export class PaymentNotFoundError extends Error {
  constructor() {
    super('The payment was not found.');
    this.name = 'PaymentNotFoundError';
  }
}
export class PaymentForbiddenError extends Error {
  constructor() {
    super('You cannot access this payment.');
    this.name = 'PaymentForbiddenError';
  }
}
export class DuplicatePaymentError extends Error {
  constructor() {
    super('A payment already exists for this Session and payer.');
    this.name = 'DuplicatePaymentError';
  }
}
export class PaymentStateError extends Error {
  constructor() {
    super('The payment cannot transition to the requested state.');
    this.name = 'PaymentStateError';
  }
}
export class PaymentTermsError extends Error {
  constructor() {
    super('The paid Session terms have not been accepted.');
    this.name = 'PaymentTermsError';
  }
}
export class PaymentEligibilityError extends Error {
  constructor() {
    super('The recipient is not eligible to offer a paid Session.');
    this.name = 'PaymentEligibilityError';
  }
}
export class PaymentAmountError extends Error {
  constructor() {
    super('The Session price is not a valid INR amount.');
    this.name = 'PaymentAmountError';
  }
}
export class RefundError extends Error {
  constructor() {
    super('The refund request is not allowed.');
    this.name = 'RefundError';
  }
}
