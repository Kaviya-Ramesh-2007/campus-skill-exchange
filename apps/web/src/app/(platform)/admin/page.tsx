'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, EmptyState, Loading } from '@campus-skill-exchange/ui';
import { useAuth } from '../../../features/auth/auth-provider';
import { getAnalyticsOverview, getLiveness, getReadiness } from '../../../features/admin/admin-api';
import type { LivenessReport, ReadinessReport } from '../../../features/admin/admin-api';
import type { AnalyticsOverview } from '@campus-skill-exchange/contracts';

/**
 * Admin areas that do not have a real route yet. These are intentionally
 * non-navigable: a card that cannot go anywhere must not pretend to be a link,
 * and it must never display invented data.
 */
const ADMIN_AREAS = [
  {
    key: 'users',
    name: 'Users',
    description: 'Review and manage User accounts and their standing.',
    available: true,
    href: '/discover',
  },
  {
    key: 'safety',
    name: 'Reports & Safety',
    description: 'Review member reports and act on safety concerns.',
    available: false,
  },
  {
    key: 'analytics',
    name: 'Analytics',
    description: 'Platform-wide adoption and growth reporting.',
    available: false,
  },
  {
    key: 'activity',
    name: 'System Activity',
    description: 'A chronological view of system events and audit history.',
    available: false,
  },
] as const;

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = Boolean(user?.roles?.includes('ADMIN'));

  return (
    <div className="content-stack admin">
      {authLoading ? (
        <Loading label="Checking your session" />
      ) : !user ? (
        <Alert severity="info" title="Sign in required">
          Sign in with an administrator account to continue.
        </Alert>
      ) : !isAdmin ? (
        // A non-ADMIN never sees the admin header, navigation or content.
        <EmptyState
          title="Administrator access required"
          description="Your account does not hold the ADMIN role, so this area is not available to you."
        />
      ) : (
        <>
          <section className="admin-hero">
            <div>
              <p className="eyebrow">Administration</p>
              <h1>Admin Control Center</h1>
              <p className="admin-hero__sub">
                Restricted area. Everything here is limited to the ADMIN authorization role.
              </p>
            </div>
            <div className="admin-hero__identity">
              <span className="admin-hero__identity-label">Signed in as</span>
              <strong>{user.displayName}</strong>
              <Badge tone="danger">ADMIN</Badge>
            </div>
          </section>

          <PlatformOverview />

          <nav className="admin-grid" aria-label="Admin areas">
            {ADMIN_AREAS.map((area) =>
              area.available && 'href' in area ? (
                <Link key={area.key} className="admin-card" href={area.href}>
                  <span className="admin-card__header">
                    <strong>{area.name}</strong>
                    <Badge tone="success">Available</Badge>
                  </span>
                  <span className="admin-card__description">{area.description}</span>
                </Link>
              ) : (
                <div key={area.key} className="admin-card admin-card--soon" aria-disabled="true">
                  <span className="admin-card__header">
                    <strong>{area.name}</strong>
                    <Badge tone="neutral">Coming soon</Badge>
                  </span>
                  <span className="admin-card__description">{area.description}</span>
                  <span className="admin-card__soon-note">
                    No data is shown here because this area is not built yet.
                  </span>
                </div>
              ),
            )}
          </nav>

          <SystemStatus />
        </>
      )}
    </div>
  );
}

const METRIC_LABELS: { key: keyof AnalyticsOverview; label: string }[] = [
  { key: 'totalUsers', label: 'Members' },
  { key: 'activeUsers', label: 'Active members' },
  { key: 'totalSkills', label: 'Skills' },
  { key: 'totalSessions', label: 'Sessions' },
  { key: 'completedSessions', label: 'Completed sessions' },
  { key: 'paidSessions', label: 'Paid sessions' },
  { key: 'totalReports', label: 'Reports' },
  { key: 'openReports', label: 'Open reports' },
];

/**
 * Real counters only. While loading, or if the request fails, no number is
 * rendered at all rather than a placeholder or an invented figure.
 */
function PlatformOverview() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await getAnalyticsOverview();
        if (active) setOverview(result);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="platform-overview-heading">
      <div className="section-heading">
        <h2 id="platform-overview-heading">Platform Overview</h2>
        <Badge tone="info">ADMIN</Badge>
      </div>

      {loading && <Loading label="Loading platform metrics" />}
      {error && (
        <Alert severity="error" title="Analytics unavailable">
          Platform analytics are unavailable right now.
        </Alert>
      )}

      {!loading && !error && overview && (
        <ul className="admin-metrics">
          {METRIC_LABELS.map((metric) => (
            <li key={String(metric.key)} className="admin-metric">
              <span className="admin-metric__value">
                {overview[metric.key].toLocaleString('en-IN')}
              </span>
              <span className="admin-metric__label">{metric.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SystemStatus() {
  const [liveness, setLiveness] = useState<LivenessReport | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Real checks from the existing public health endpoints.
    void (async () => {
      try {
        const [live, ready] = await Promise.allSettled([getLiveness(), getReadiness()]);
        if (!active) return;
        if (live.status === 'fulfilled') setLiveness(live.value);
        if (ready.status === 'fulfilled') setReadiness(ready.value);
        if (live.status === 'rejected' && ready.status === 'rejected') {
          setError('System status is unavailable right now.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card
      title="System status"
      description="Live checks reported by the API. No values are cached or estimated here."
    >
      {loading && <Loading label="Checking system status" />}
      {error && (
        <Alert severity="error" title="Status unavailable">
          {error}
        </Alert>
      )}
      {!loading && (
        <ul className="admin-status">
          <li>
            <span>API process</span>
            {liveness ? (
              <Badge tone={liveness.checks.process.status === 'up' ? 'success' : 'danger'}>
                {liveness.checks.process.status === 'up' ? 'Operational' : 'Down'}
              </Badge>
            ) : (
              <Badge tone="neutral">Unknown</Badge>
            )}
          </li>
          <li>
            <span>Database</span>
            {readiness ? (
              <Badge tone={readiness.checks.database.status === 'up' ? 'success' : 'danger'}>
                {readiness.checks.database.status === 'up' ? 'Connected' : 'Unavailable'}
              </Badge>
            ) : (
              <Badge tone="neutral">Unknown</Badge>
            )}
          </li>
          <li>
            <span>API version</span>
            <span className="admin-status__value">{liveness?.version ?? '—'}</span>
          </li>
          <li>
            <span>Uptime</span>
            <span className="admin-status__value">
              {liveness ? `${Math.floor(liveness.uptimeSeconds / 60)} min` : '—'}
            </span>
          </li>
        </ul>
      )}
    </Card>
  );
}
