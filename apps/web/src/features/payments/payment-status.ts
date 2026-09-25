import type { PaymentStatus } from '@campus-skill-exchange/contracts';
import type { BadgeProps } from '@campus-skill-exchange/ui';

export type BadgeTone = NonNullable<BadgeProps['tone']>;

export interface PaymentStatusView {
  /** Human label shown to the User. */
  label: string;
  tone: BadgeTone;
  /** Short explanation of what this status actually means. */
  description: string;
}

/**
 * Copy deliberately avoids claiming success. Only CAPTURED, REFUNDED and
 * PARTIALLY_REFUNDED are settled states confirmed by the server; AUTHORIZED
 * means the signature verified but the provider webhook has not confirmed yet.
 */
const STATUS_VIEWS: Record<PaymentStatus, PaymentStatusView> = {
  CREATED: {
    label: 'Payment required',
    tone: 'warning',
    description: 'A payment has not been started for this Session yet.',
  },
  PENDING: {
    label: 'Payment processing',
    tone: 'info',
    description: 'Razorpay is processing this payment.',
  },
  AUTHORIZED: {
    label: 'Payment verifying',
    tone: 'info',
    description: 'The payment signature verified. Waiting for Razorpay to confirm the capture.',
  },
  CAPTURED: {
    label: 'Payment successful',
    tone: 'success',
    description: 'Razorpay confirmed the payment was captured.',
  },
  FAILED: {
    label: 'Payment failed',
    tone: 'danger',
    description: 'The payment did not complete. No money was taken.',
  },
  CANCELLED: {
    label: 'Payment cancelled',
    tone: 'neutral',
    description: 'The payment was cancelled before completion.',
  },
  REFUND_PENDING: {
    label: 'Refund requested',
    tone: 'warning',
    description: 'Razorpay is processing the refund. No money has returned yet.',
  },
  REFUNDED: {
    label: 'Refunded',
    tone: 'success',
    description: 'Razorpay confirmed the full refund.',
  },
  PARTIALLY_REFUNDED: {
    label: 'Partially refunded',
    tone: 'success',
    description: 'Razorpay confirmed a partial refund.',
  },
};

export function paymentStatusView(status: PaymentStatus): PaymentStatusView {
  return STATUS_VIEWS[status] ?? STATUS_VIEWS.CREATED;
}

/**
 * The server decides whether a refund is allowed. This mirrors that rule for
 * display only so the UI can hide the action instead of offering one that the
 * API will reject: a non-ADMIN payer may only refund a captured payment for a
 * Session the server has already moved to CANCELLED or NO_SHOW.
 */
export function canRequestRefund(
  status: PaymentStatus,
  sessionStatus: string | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return status === 'CAPTURED' || status === 'PARTIALLY_REFUNDED';
  if (status !== 'CAPTURED') return false;
  return sessionStatus === 'CANCELLED' || sessionStatus === 'NO_SHOW';
}
