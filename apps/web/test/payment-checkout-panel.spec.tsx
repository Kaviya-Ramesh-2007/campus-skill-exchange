import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentCheckoutPanel } from '../src/features/payments/payment-checkout-panel';
import type * as RazorpayCheckout from '../src/features/payments/razorpay-checkout';
import type { Session } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  createPaymentOrder: vi.fn(),
  verifyPayment: vi.fn(),
  openRazorpayCheckout: vi.fn(),
}));

vi.mock('../src/features/payments/payments-api', () => ({
  createPaymentOrder: mocks.createPaymentOrder,
  verifyPayment: mocks.verifyPayment,
}));

vi.mock('../src/features/payments/razorpay-checkout', async () => {
  const actual = await vi.importActual<typeof RazorpayCheckout>(
    '../src/features/payments/razorpay-checkout',
  );
  return { ...actual, openRazorpayCheckout: mocks.openRazorpayCheckout };
});

const currentUserId = '00000000-0000-4000-8000-000000000001';
const partnerId = '00000000-0000-4000-8000-000000000002';

const session: Session = {
  id: '00000000-0000-4000-8000-000000000003',
  sessionRequestId: '00000000-0000-4000-8000-000000000004',
  host: { userId: partnerId, displayName: 'Priya' },
  participant: { userId: currentUserId, displayName: 'Arun' },
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

const capturedPayment = {
  id: '00000000-0000-4000-8000-000000000006',
  sessionId: session.id,
  payerUserId: currentUserId,
  recipientUserId: partnerId,
  amountPaise: 15000,
  currency: 'INR',
  provider: 'RAZORPAY',
  providerOrderId: 'order_test_1',
  providerPaymentId: 'pay_test_1',
  status: 'CAPTURED',
  termsVersion: '2026-10-01-v1',
  termsAcceptedAt: '2026-10-01T12:00:00.000Z',
  termsAcceptedBy: currentUserId,
  paidAt: '2026-10-04T12:31:00.000Z',
  failureReason: null,
  refundAmountPaise: 0,
  refundProviderId: null,
  refundReason: null,
  refundedAt: null,
  transactions: [],
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-04T12:31:00.000Z',
};

function renderPanel() {
  return render(
    <PaymentCheckoutPanel session={session} partnerName="Priya" currentUserId={currentUserId} />,
  );
}

async function acceptTermsAndPay() {
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /Pay/ }));
}

describe('PaymentCheckoutPanel', () => {
  beforeEach(() => {
    mocks.createPaymentOrder.mockReset();
    mocks.verifyPayment.mockReset();
    mocks.openRazorpayCheckout.mockReset();
  });

  afterEach(() => cleanup());

  it('renders real session context and the server-side price', () => {
    renderPanel();
    expect(
      screen.getByRole('heading', { name: 'Complete your session payment' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Advanced Python')).toBeInTheDocument();
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByText('₹150')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay ₹150' })).toBeInTheDocument();
  });

  it('keeps the pay button disabled until the terms are accepted', () => {
    renderPanel();
    const payButton = screen.getByRole('button', { name: 'Pay ₹150' });
    expect(payButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(payButton).toBeEnabled();
  });

  it('sends the current terms version and the public key flow to Razorpay', async () => {
    mocks.createPaymentOrder.mockResolvedValue({
      paymentId: capturedPayment.id,
      providerOrderId: 'order_test_1',
      amountPaise: 15000,
      currency: 'INR',
      keyId: 'rzp_test_public',
    });
    mocks.openRazorpayCheckout.mockResolvedValue({ outcome: 'cancelled' });
    mocks.verifyPayment.mockResolvedValue(capturedPayment);

    renderPanel();
    await acceptTermsAndPay();

    await waitFor(() => expect(mocks.createPaymentOrder).toHaveBeenCalled());
    expect(mocks.createPaymentOrder).toHaveBeenCalledWith({
      sessionId: session.id,
      termsVersion: '2026-10-01-v1',
      termsAccepted: true,
    });
    await waitFor(() => expect(mocks.openRazorpayCheckout).toHaveBeenCalled());
    expect(mocks.openRazorpayCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'rzp_test_public', amountPaise: 15000, currency: 'INR' }),
    );
  });

  it('only reports success after the server confirms the payment', async () => {
    mocks.createPaymentOrder.mockResolvedValue({
      paymentId: capturedPayment.id,
      providerOrderId: 'order_test_1',
      amountPaise: 15000,
      currency: 'INR',
      keyId: 'rzp_test_public',
    });
    mocks.openRazorpayCheckout.mockResolvedValue({
      outcome: 'success',
      payment: {
        razorpayOrderId: 'order_test_1',
        razorpayPaymentId: 'pay_test_1',
        razorpaySignature: 'sig',
      },
    });
    mocks.verifyPayment.mockResolvedValue(capturedPayment);

    renderPanel();
    await acceptTermsAndPay();

    await waitFor(() => expect(mocks.verifyPayment).toHaveBeenCalled());
    expect(mocks.verifyPayment).toHaveBeenCalledWith({
      paymentId: capturedPayment.id,
      providerOrderId: 'order_test_1',
      providerPaymentId: 'pay_test_1',
      signature: 'sig',
    });
    expect(await screen.findByText('Payment confirmed')).toBeInTheDocument();
  });

  it('does not claim success when the server still reports the payment as verifying', async () => {
    mocks.createPaymentOrder.mockResolvedValue({
      paymentId: capturedPayment.id,
      providerOrderId: 'order_test_1',
      amountPaise: 15000,
      currency: 'INR',
      keyId: 'rzp_test_public',
    });
    mocks.openRazorpayCheckout.mockResolvedValue({
      outcome: 'success',
      payment: {
        razorpayOrderId: 'order_test_1',
        razorpayPaymentId: 'pay_test_1',
        razorpaySignature: 'sig',
      },
    });
    mocks.verifyPayment.mockResolvedValue({
      ...capturedPayment,
      status: 'AUTHORIZED',
      paidAt: null,
    });

    renderPanel();
    await acceptTermsAndPay();

    expect(await screen.findByText('Payment not settled yet')).toBeInTheDocument();
    expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
  });

  it('treats a cancelled checkout as not paid', async () => {
    mocks.createPaymentOrder.mockResolvedValue({
      paymentId: capturedPayment.id,
      providerOrderId: 'order_test_1',
      amountPaise: 15000,
      currency: 'INR',
      keyId: 'rzp_test_public',
    });
    mocks.openRazorpayCheckout.mockResolvedValue({ outcome: 'cancelled' });

    renderPanel();
    await acceptTermsAndPay();

    expect(
      await screen.findByText('You cancelled the payment. No money has been taken.'),
    ).toBeInTheDocument();
    expect(mocks.verifyPayment).not.toHaveBeenCalled();
  });

  it('treats a provider failure as not paid', async () => {
    mocks.createPaymentOrder.mockResolvedValue({
      paymentId: capturedPayment.id,
      providerOrderId: 'order_test_1',
      amountPaise: 15000,
      currency: 'INR',
      keyId: 'rzp_test_public',
    });
    mocks.openRazorpayCheckout.mockResolvedValue({ outcome: 'failed', reason: 'declined' });

    renderPanel();
    await acceptTermsAndPay();

    expect(
      await screen.findByText('The payment was not completed. No money has been taken.'),
    ).toBeInTheDocument();
    expect(mocks.verifyPayment).not.toHaveBeenCalled();
  });

  it('shows a clean error when order creation fails', async () => {
    mocks.createPaymentOrder.mockRejectedValue(new Error('gateway down'));

    renderPanel();
    await acceptTermsAndPay();

    expect(
      await screen.findByText('We could not start this payment. Please try again in a moment.'),
    ).toBeInTheDocument();
    expect(mocks.openRazorpayCheckout).not.toHaveBeenCalled();
  });
});
