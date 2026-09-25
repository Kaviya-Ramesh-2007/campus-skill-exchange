'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Alert, Badge, Button, Card, Loading } from '@campus-skill-exchange/ui';
import type { Payment, Session } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../../features/auth/auth-provider';
import { PaymentCheckoutPanel } from '../../../../features/payments/payment-checkout-panel';
import { formatInr } from '../../../../features/payments/money';
import { paymentStatusView } from '../../../../features/payments/payment-status';
import { getSession } from '../../../../features/payments/sessions-api';
import { listPaymentHistory } from '../../../../features/payments/payments-api';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SessionPaymentPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId;
  const { user, isLoading: authLoading } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const loadedSession = await getSession(sessionId);
      setSession(loadedSession);
      try {
        setPayment(await getExistingPayment(loadedSession, user.id));
      } catch {
        setPayment(null);
      }
    } catch {
      setError('Unable to load this session right now.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    // Session and payment state are read from the authenticated server session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) {
    return (
      <div className="content-stack">
        <Alert severity="info" title="Sign in required">
          Sign in to pay for this session.
        </Alert>
        <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
          Sign in
        </Link>
      </div>
    );
  }
  if (loading) return <Loading label="Loading this session" />;
  if (error || !session) {
    return (
      <div className="content-stack">
        <Alert severity="error" title="Session unavailable">
          {error ?? 'This session could not be found.'}
        </Alert>
        <Button variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  const isHost = session.host.userId === user.id;
  const partner = isHost ? session.participant : session.host;
  const isPaid = session.paymentMode === 'PAID';
  const status = payment ? paymentStatusView(payment.status) : null;

  return (
    <div className="content-stack payments-page">
      <div className="page-heading">
        <p className="eyebrow">Session</p>
        <h1>{session.skill?.name ?? 'Skill exchange session'}</h1>
        <p>
          {formatDate(session.scheduledStart)} ·{' '}
          {session.mode === 'ONLINE' ? 'Online' : 'In person'}
        </p>
      </div>

      <Card title="Session overview">
        <dl className="payment-summary">
          <div>
            <dt>Partner</dt>
            <dd>{partner.displayName}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{isHost ? 'You are hosting' : 'You are attending'}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <Badge tone="info">{session.status.toLowerCase()}</Badge>
            </dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{session.mode === 'ONLINE' ? 'Online' : 'In person'}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{isPaid ? 'Paid session' : 'Free session'}</dd>
          </div>
          {isPaid && (
            <div>
              <dt>Price</dt>
              <dd>{formatInr(session.pricePaise ?? 0)}</dd>
            </div>
          )}
        </dl>
      </Card>

      {status && (
        <Alert severity={payment?.status === 'CAPTURED' ? 'success' : 'info'} title={status.label}>
          {status.description}
        </Alert>
      )}

      {isPaid && !isHost ? (
        <PaymentCheckoutPanel
          session={session}
          partnerName={partner.displayName}
          currentUserId={user.id}
          onConfirmed={(confirmed) => setPayment(confirmed)}
        />
      ) : isPaid ? (
        <Alert severity="info" title="You are hosting this paid session">
          The other participant completes the payment. You receive it once Razorpay confirms the
          capture.
        </Alert>
      ) : (
        <Alert severity="success" title="This session is free">
          No payment is required for this session.
        </Alert>
      )}

      <Link className="cse-button cse-button--secondary cse-button--md" href="/payments">
        View payment history
      </Link>
    </div>
  );
}

/**
 * The payment history endpoint is owner-scoped, so a payer who already started
 * paying will find their Payment there even when the webhook has not fired yet.
 */
async function getExistingPayment(session: Session, userId: string): Promise<Payment | null> {
  const history = await listPaymentHistory();
  return (
    history.find((payment) => payment.sessionId === session.id && payment.payerUserId === userId) ??
    null
  );
}
