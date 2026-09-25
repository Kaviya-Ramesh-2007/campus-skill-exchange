'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, EmptyState, Loading } from '@campus-skill-exchange/ui';
import type { Report, ReportCategory, ReportStatus } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../features/auth/auth-provider';
import {
  createReport,
  listReports,
  updateReportStatus,
} from '../../../features/reports/reports-api';

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment or abuse' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'FAKE_PROFILE', label: 'Fake or misleading profile' },
  { value: 'SUSPICIOUS_PAYMENT', label: 'Suspicious payment activity' },
  { value: 'FRAUDULENT_CERTIFICATION', label: 'Fraudulent certification' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
  { value: 'OTHER', label: 'Something else' },
];

const STATUSES: { value: ReportStatus; label: string; tone: 'neutral' | 'info' | 'success' }[] = [
  { value: 'OPEN', label: 'Open', tone: 'neutral' },
  { value: 'UNDER_REVIEW', label: 'Under review', tone: 'info' },
  { value: 'RESOLVED', label: 'Resolved', tone: 'success' },
  { value: 'DISMISSED', label: 'Dismissed', tone: 'neutral' },
];

const statusTone: Record<ReportStatus, 'neutral' | 'info' | 'success'> = {
  OPEN: 'neutral',
  UNDER_REVIEW: 'info',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
};

const statusLabel: Record<ReportStatus, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

const categoryLabel = (value: ReportCategory) =>
  CATEGORIES.find((item) => item.value === value)?.label ?? value;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReportsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportedUserId, setReportedUserId] = useState('');
  const [category, setCategory] = useState<ReportCategory>('HARASSMENT');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = Boolean(user?.roles?.includes('ADMIN'));
  const canSubmit =
    reportedUserId.trim().length > 0 && description.trim().length >= 20 && !submitting;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setReports(await listReports());
    } catch {
      setError('Unable to load reports right now.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Reports are always read from the authenticated server session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitted(false);
    try {
      const created = await createReport({
        reportedUserId: reportedUserId.trim(),
        category,
        description: description.trim(),
      });
      setReports((items) => [created, ...items]);
      setDescription('');
      setSubmitted(true);
    } catch {
      setSubmitError('Your report could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(report: Report, status: ReportStatus) {
    setUpdatingId(report.id);
    try {
      const updated = await updateReportStatus(report.id, status);
      setReports((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setError('That status change was rejected.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) {
    return (
      <div className="content-stack">
        <Alert severity="info" title="Sign in required">
          Sign in to file or review safety reports.
        </Alert>
        <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="content-stack payments-page">
      <div className="page-heading">
        <p className="eyebrow">Safety</p>
        <h1>Safety &amp; Reports</h1>
        <p>Report a problem with another member. An administrator reviews every report.</p>
      </div>

      {error && (
        <Alert severity="error" title="Reports unavailable">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      )}

      <Card title="File a report" description="Tell us what happened. Be specific and factual.">
        <div className="report-form">
          <label className="ai-field">
            <span className="cse-field__label">User ID being reported</span>
            <input
              className="cse-input"
              value={reportedUserId}
              onChange={(event) => setReportedUserId(event.target.value)}
              placeholder="Paste the member's User ID"
              disabled={submitting}
            />
          </label>

          <label className="ai-field">
            <span className="cse-field__label">Category</span>
            <select
              className="cse-input"
              value={category}
              onChange={(event) => setCategory(event.target.value as ReportCategory)}
              disabled={submitting}
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ai-field">
            <span className="cse-field__label">What happened?</span>
            <textarea
              className="cse-input"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what happened, when, and any evidence you can share."
              disabled={submitting}
            />
            <span className="ai-hint">At least 20 characters.</span>
          </label>

          {submitError && (
            <Alert severity="error" title="Report not submitted">
              {submitError}
            </Alert>
          )}
          {submitted && (
            <Alert severity="success" title="Report submitted">
              Thank you. An administrator will review it.
            </Alert>
          )}

          <Button onClick={() => void handleSubmit()} disabled={!canSubmit} loading={submitting}>
            {submitting ? 'Submitting' : 'Submit report'}
          </Button>
        </div>
      </Card>

      {isAdmin && (
        <Card
          title="Admin review"
          description="Every report on the platform. Only an administrator can change a status."
        >
          {loading ? (
            <Loading label="Loading reports" />
          ) : reports.length === 0 ? (
            <EmptyState title="No reports filed" description="Nothing has been reported yet." />
          ) : (
            <ul className="report-list">
              {reports.map((report) => (
                <li key={report.id} className="report-item">
                  <div className="report-item__head">
                    <strong>{categoryLabel(report.category)}</strong>
                    <Badge tone={statusTone[report.status]}>{statusLabel[report.status]}</Badge>
                  </div>
                  <p className="report-item__description">{report.description}</p>
                  <p className="report-item__meta">
                    Filed {formatDate(report.createdAt)} · reported User {report.reportedUserId}
                  </p>
                  <label className="ai-field">
                    <span className="cse-field__label">Update status</span>
                    <select
                      className="cse-input"
                      value={report.status}
                      disabled={updatingId === report.id}
                      onChange={(event) =>
                        void handleStatusChange(report, event.target.value as ReportStatus)
                      }
                    >
                      {STATUSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title={isAdmin ? 'All reports' : 'Your reports'}>
        {loading ? (
          <Loading label="Loading your reports" />
        ) : reports.length === 0 ? (
          <EmptyState
            title="You have not filed any reports"
            description="Reports you submit will appear here with their current status."
          />
        ) : (
          <ul className="report-list">
            {reports.map((report) => (
              <li key={report.id} className="report-item">
                <div className="report-item__head">
                  <strong>{categoryLabel(report.category)}</strong>
                  <Badge tone={statusTone[report.status]}>{statusLabel[report.status]}</Badge>
                </div>
                <p className="report-item__description">{report.description}</p>
                <p className="report-item__meta">Submitted {formatDate(report.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
