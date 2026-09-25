'use client';

import { useState } from 'react';
import { Alert, Badge, Button, EmptyState, Loading, Modal } from '@campus-skill-exchange/ui';
import type { Payment, Session } from '@campus-skill-exchange/contracts';
import { formatInr } from './money';
import { canRequestRefund, paymentStatusView } from './payment-status';
import { requestRefund } from './payments-api';

export interface PaymentHistoryProps {
  payments: Payment[];
  sessions: Session[];
  isAdmin: boolean;
  onRefresh: () => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PaymentHistory({ payments, sessions, isAdmin, onRefresh }: PaymentHistoryProps) {
  const [selected, setSelected] = useState<Payment | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refundState, setRefundState] = useState<'idle' | 'working' | 'error'>('idle');
  const [refundError, setRefundError] = useState<string | null>(null);

  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  async function handleRefund() {
    if (!selected || !reason.trim() || refundState === 'working') return;
    setRefundState('working');
    setRefundError(null);
    try {
      const updated = await requestRefund(selected.id, { reason: reason.trim() });
      setSelected(updated);
      setRefundOpen(false);
      setReason('');
      setRefundState('idle');
      onRefresh();
    } catch {
      setRefundState('error');
      setRefundError('The refund could not be requested. Please try again.');
    }
  }

  if (payments.length === 0) {
    return (
      <EmptyState
        title="No payment activity yet."
        description="Paid Sessions you take part in will appear here with their real status."
      />
    );
  }

  return (
    <>
      <ul className="payment-history">
        {payments.map((payment) => {
          const session = sessionById.get(payment.sessionId);
          const view = paymentStatusView(payment.status);
          const refundable = canRequestRefund(payment.status, session?.status, isAdmin);
          return (
            <li key={payment.id} className="payment-history__item">
              <div className="payment-history__main">
                <div>
                  <h3>{session?.skill?.name ?? 'Session payment'}</h3>
                  <p className="payment-history__meta">
                    {formatDate(payment.createdAt)}
                    {session ? ` · ${session.mode === 'ONLINE' ? 'Online' : 'In person'}` : ''}
                  </p>
                </div>
                <div className="payment-history__amount">
                  <strong>{formatInr(payment.amountPaise)}</strong>
                  <Badge tone={view.tone}>{view.label}</Badge>
                </div>
              </div>
              <div className="payment-history__actions">
                <Button variant="secondary" size="sm" onClick={() => setSelected(payment)}>
                  View details
                </Button>
                {refundable && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setSelected(payment);
                      setRefundOpen(true);
                      setRefundState('idle');
                      setRefundError(null);
                    }}
                  >
                    Request refund
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={selected !== null}
        title="Payment details"
        onClose={() => {
          setSelected(null);
          setRefundOpen(false);
        }}
      >
        {selected && (
          <div className="payment-detail">
            <div className="payment-detail__headline">
              <strong>{formatInr(selected.amountPaise)}</strong>
              <Badge tone={paymentStatusView(selected.status).tone}>
                {paymentStatusView(selected.status).label}
              </Badge>
            </div>
            <Alert severity="info" title={paymentStatusView(selected.status).label}>
              {paymentStatusView(selected.status).description}
            </Alert>

            <dl className="payment-summary">
              <div>
                <dt>Session</dt>
                <dd>{sessionById.get(selected.sessionId)?.skill?.name ?? selected.sessionId}</dd>
              </div>
              <div>
                <dt>Terms version</dt>
                <dd>{selected.termsVersion}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
              </div>
              {selected.paidAt && (
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDate(selected.paidAt)}</dd>
                </div>
              )}
              {selected.refundAmountPaise > 0 && (
                <div>
                  <dt>Refunded</dt>
                  <dd>{formatInr(selected.refundAmountPaise)}</dd>
                </div>
              )}
            </dl>

            {selected.transactions.length > 0 && (
              <table className="payment-ledger">
                <caption>Transaction history</caption>
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.type === 'REFUND' ? 'Refund' : 'Payment'}</td>
                      <td>{formatInr(transaction.amountPaise)}</td>
                      <td>{transaction.status.toLowerCase()}</td>
                      <td>{formatDate(transaction.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {canRequestRefund(
              selected.status,
              sessionById.get(selected.sessionId)?.status,
              isAdmin,
            ) &&
              !refundOpen && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setRefundOpen(true);
                    setRefundState('idle');
                    setRefundError(null);
                  }}
                >
                  Request refund
                </Button>
              )}
          </div>
        )}
      </Modal>

      <Modal open={refundOpen} title="Request a refund" onClose={() => setRefundOpen(false)}>
        <div className="payment-detail">
          <p>
            Razorpay processes refunds. The status below only changes once the provider confirms it.
          </p>
          <label className="payment-terms__checkbox">
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for the refund"
              disabled={refundState === 'working'}
            />
            <span className="cse-field__label">Refund reason</span>
          </label>
          {refundError && (
            <Alert severity="error" title="Refund not requested">
              {refundError}
            </Alert>
          )}
          <Button
            variant="danger"
            onClick={() => void handleRefund()}
            disabled={!reason.trim()}
            loading={refundState === 'working'}
          >
            {refundState === 'working' ? 'Requesting refund' : 'Request refund'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function PaymentHistoryLoading() {
  return <Loading label="Loading your payments" />;
}
