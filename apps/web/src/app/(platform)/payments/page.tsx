'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Loading } from '@campus-skill-exchange/ui';
import type { Payment, Session } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../features/auth/auth-provider';
import { PaymentHistory } from '../../../features/payments/payment-history';
import { listPaymentHistory } from '../../../features/payments/payments-api';
import { listSessions } from '../../../features/payments/sessions-api';

export default function PaymentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [paymentRecords, sessionPage] = await Promise.all([
        listPaymentHistory(),
        listSessions(),
      ]);
      setPayments(paymentRecords);
      setSessions(sessionPage.items);
    } catch {
      setError('Unable to load your payments right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Payment data is always read from the authenticated server session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const isAdmin = useMemo(() => user?.roles?.includes('ADMIN') ?? false, [user]);

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) {
    return (
      <div className="content-stack">
        <Alert severity="info" title="Sign in required">
          Sign in to view your payments.
        </Alert>
        <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
          Sign in
        </Link>
      </div>
    );
  }
  if (loading) return <Loading label="Loading your payments" />;

  return (
    <div className="content-stack payments-page">
      <div className="page-heading">
        <p className="eyebrow">Payments</p>
        <h1>Your payments</h1>
        <p>Every amount below comes from the server. No payment is marked successful here.</p>
      </div>

      {error && (
        <Alert severity="error" title="Payments unavailable">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      )}

      {!error && (
        <PaymentHistory
          payments={payments}
          sessions={sessions}
          isAdmin={isAdmin}
          onRefresh={load}
        />
      )}
    </div>
  );
}
