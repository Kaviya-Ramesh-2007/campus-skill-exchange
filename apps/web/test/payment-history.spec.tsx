import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentHistory } from '../src/features/payments/payment-history';
import type { Payment, Session } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({ requestRefund: vi.fn() }));

vi.mock('../src/features/payments/payments-api', () => ({ requestRefund: mocks.requestRefund }));

const sessionId = '00000000-0000-4000-8000-000000000003';

const session: Session = {
  id: sessionId,
  sessionRequestId: '00000000-0000-4000-8000-000000000004',
  host: { userId: '00000000-0000-4000-8000-000000000002', displayName: 'Priya' },
  participant: { userId: '00000000-0000-4000-8000-000000000001', displayName: 'Arun' },
  skill: { id: '00000000-0000-4000-8000-000000000005', name: 'Advanced Python' },
  mode: 'ONLINE',
  status: 'SCHEDULED',
  scheduledStart: '2026-10-04T12:30:00.000Z',
  scheduledEnd: '2026-10-04T13:30:00.000Z',
  timezone: 'Asia/Kolkata',
  meetingUrl: null,
  locationDetails: null,
  googleConferenceStatus: null,
  paymentMode: 'PAID',
  pricePaise: 15000,
  termsVersion: '2026-10-01-v1',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: '00000000-0000-4000-8000-000000000006',
    sessionId,
    payerUserId: session.participant.userId,
    recipientUserId: session.host.userId,
    amountPaise: 15000,
    currency: 'INR',
    provider: 'RAZORPAY',
    providerOrderId: 'order_test_1',
    providerPaymentId: 'pay_test_1',
    status: 'CAPTURED',
    termsVersion: '2026-10-01-v1',
    termsAcceptedAt: '2026-10-01T12:00:00.000Z',
    termsAcceptedBy: session.participant.userId,
    paidAt: '2026-10-04T12:31:00.000Z',
    failureReason: null,
    refundAmountPaise: 0,
    refundProviderId: null,
    refundReason: null,
    refundedAt: null,
    transactions: [],
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-04T12:31:00.000Z',
    ...overrides,
  };
}

function renderHistory(payments: Payment[], sessionStatus = 'SCHEDULED', isAdmin = false) {
  const sessions: Session[] = [{ ...session, status: sessionStatus as Session['status'] }];
  return render(
    <PaymentHistory
      payments={payments}
      sessions={sessions}
      isAdmin={isAdmin}
      onRefresh={() => undefined}
    />,
  );
}

describe('PaymentHistory', () => {
  afterEach(() => {
    cleanup();
    mocks.requestRefund.mockReset();
  });

  it('shows the empty state when there is no payment activity', () => {
    renderHistory([]);
    expect(screen.getByText('No payment activity yet.')).toBeInTheDocument();
  });

  it('renders the real amount, session context, and status', () => {
    renderHistory([payment()]);
    expect(screen.getByRole('heading', { name: 'Advanced Python' })).toBeInTheDocument();
    expect(screen.getByText('₹150')).toBeInTheDocument();
    expect(screen.getByText('Payment successful')).toBeInTheDocument();
    expect(screen.getByText(/Online/)).toBeInTheDocument();
  });

  it('does not offer a refund for a live scheduled session', () => {
    renderHistory([payment()], 'SCHEDULED');
    expect(screen.queryByRole('button', { name: 'Request refund' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument();
  });

  it('offers a refund once the server moved the session to CANCELLED', async () => {
    renderHistory([payment()], 'CANCELLED');
    const refundButton = screen.getByRole('button', { name: 'Request refund' });
    expect(refundButton).toBeInTheDocument();

    mocks.requestRefund.mockResolvedValue(payment({ status: 'REFUND_PENDING' }));
    fireEvent.click(refundButton);
    fireEvent.change(screen.getByPlaceholderText('Reason for the refund'), {
      target: { value: 'Tutor cancelled' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Request refund' }).at(-1)!);

    expect(mocks.requestRefund).toHaveBeenCalledWith(payment().id, { reason: 'Tutor cancelled' });
  });

  it('never offers a refund for a payment that is not captured', () => {
    renderHistory([payment({ status: 'PENDING', paidAt: null })], 'CANCELLED');
    expect(screen.queryByRole('button', { name: 'Request refund' })).not.toBeInTheDocument();
    expect(screen.getByText('Payment processing')).toBeInTheDocument();
  });

  it('shows refund states from the server without inventing success', () => {
    renderHistory(
      [payment({ status: 'REFUND_PENDING', refundReason: 'Tutor cancelled' })],
      'CANCELLED',
    );
    expect(screen.getByText('Refund requested')).toBeInTheDocument();
    expect(screen.queryByText('Refunded')).not.toBeInTheDocument();
  });
});
