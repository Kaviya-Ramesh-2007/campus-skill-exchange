'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, Loading } from '@campus-skill-exchange/ui';
import type { Payment, Session } from '@campus-skill-exchange/contracts';
import { createPaymentOrder, verifyPayment } from './payments-api';
import { formatInr } from './money';
import { paymentStatusView } from './payment-status';
import { openRazorpayCheckout, RazorpayUnavailableError } from './razorpay-checkout';

type Stage = 'idle' | 'creating-order' | 'checkout' | 'verifying' | 'done' | 'error';

export interface PaymentCheckoutPanelProps {
  session: Session;
  /** The other participant's public display name. */
  partnerName: string;
  currentUserId: string;
  /** Called with the server-confirmed Payment record once verification finishes. */
  onConfirmed?: (payment: Payment) => void;
}

function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PaymentCheckoutPanel({
  session,
  partnerName,
  currentUserId,
  onConfirmed,
}: PaymentCheckoutPanelProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);

  const isBusy = stage === 'creating-order' || stage === 'checkout' || stage === 'verifying';
  const pricePaise = session.pricePaise ?? 0;
  const partner = session.host.userId === currentUserId ? session.participant : session.host;
  const skillName = session.skill?.name ?? 'Skill exchange session';
  const status = payment ? paymentStatusView(payment.status) : null;

  async function handlePay() {
    if (!termsAccepted || isBusy) return;
    setError(null);

    // Step 1: ask the API for a real Razorpay order. The amount is always the
    // server-side Session price; nothing about the amount is decided here.
    setStage('creating-order');
    let order;
    try {
      order = await createPaymentOrder({
        sessionId: session.id,
        termsVersion: session.termsVersion ?? '',
        termsAccepted: true,
      });
    } catch {
      setError('We could not start this payment. Please try again in a moment.');
      setStage('error');
      return;
    }

    // Step 2: open real Razorpay Checkout with the public key from the API.
    setStage('checkout');
    let result;
    try {
      result = await openRazorpayCheckout({
        key: order.keyId,
        orderId: order.providerOrderId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        name: 'Campus Skill Exchange',
        description: skillName,
        notes: { sessionId: session.id },
      });
    } catch (checkoutError) {
      setError(
        checkoutError instanceof RazorpayUnavailableError
          ? 'Secure checkout is unavailable right now. Please try again later.'
          : 'Secure checkout could not be opened. Please try again.',
      );
      setStage('error');
      return;
    }

    if (result.outcome === 'cancelled') {
      setError('You cancelled the payment. No money has been taken.');
      setStage('error');
      return;
    }
    if (result.outcome === 'failed') {
      setError('The payment was not completed. No money has been taken.');
      setStage('error');
      return;
    }

    // Step 3: the browser result is only a candidate. The API verifies the
    // Razorpay HMAC server-side and returns the authoritative status.
    setStage('verifying');
    try {
      const verified = await verifyPayment({
        paymentId: order.paymentId,
        providerOrderId: result.payment.razorpayOrderId,
        providerPaymentId: result.payment.razorpayPaymentId,
        signature: result.payment.razorpaySignature,
      });
      setPayment(verified);
      setStage('done');
      onConfirmed?.(verified);
    } catch {
      setError(
        'We could not confirm the payment yet. If money was taken, Razorpay will confirm it shortly.',
      );
      setStage('error');
    }
  }

  return (
    <Card title="Complete your session payment" className="payment-checkout">
      <dl className="payment-summary">
        <div>
          <dt>Session</dt>
          <dd>{skillName}</dd>
        </div>
        <div>
          <dt>With</dt>
          <dd>{partnerName || partner.displayName}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{formatSessionDate(session.scheduledStart)}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{session.mode === 'ONLINE' ? 'Online' : 'In person'}</dd>
        </div>
      </dl>

      <div className="payment-amount">
        <span className="payment-amount__label">Amount due</span>
        <strong className="payment-amount__value">{formatInr(pricePaise)}</strong>
        <span className="payment-amount__currency">INR</span>
      </div>

      {status && (
        <div className="payment-status-line">
          <Badge tone={status.tone}>{status.label}</Badge>
          <p>{status.description}</p>
        </div>
      )}

      {error && (
        <Alert severity="error" title="Payment not completed">
          {error}
        </Alert>
      )}

      {stage === 'creating-order' && <Loading label="Preparing secure checkout" />}
      {stage === 'checkout' && <Loading label="Waiting for Razorpay Checkout" />}
      {stage === 'verifying' && <Loading label="Verifying payment with the server" />}

      {stage === 'done' && payment?.status === 'CAPTURED' ? (
        <Alert severity="success" title="Payment confirmed">
          Razorpay confirmed ₹{formatInr(payment.amountPaise).replace('₹', '')} was captured for
          this Session.
        </Alert>
      ) : stage === 'done' ? (
        <Alert severity="info" title="Payment not settled yet">
          Razorpay has not confirmed the capture yet. This page will show the final status once it
          does.
        </Alert>
      ) : null}

      {stage !== 'done' && (
        <div className="payment-terms">
          <label className="payment-terms__checkbox">
            <input
              type="checkbox"
              checked={termsAccepted}
              disabled={isBusy}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <span>
              I agree to the payment and session terms, including the cancellation and refund
              policy.
            </span>
          </label>
          <p className="payment-terms__version">
            Terms version <code>{session.termsVersion ?? 'unavailable'}</code>
          </p>
        </div>
      )}

      {stage !== 'done' && (
        <Button
          size="lg"
          onClick={() => void handlePay()}
          disabled={!termsAccepted || isBusy}
          loading={isBusy}
        >
          {isBusy ? 'Working' : `Pay ${formatInr(pricePaise)}`}
        </Button>
      )}
    </Card>
  );
}
