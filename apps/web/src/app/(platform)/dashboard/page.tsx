'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, EmptyState, Loading } from '@campus-skill-exchange/ui';
import type { LearningGoal, Profile, Session } from '@campus-skill-exchange/contracts';
import { useAuth } from '../../../features/auth/auth-provider';
import { getCurrentProfile } from '../../../features/profile/profile-api';
import { listLearningGoals } from '../../../features/growth/growth-api';
import { listSessions } from '../../../features/payments/sessions-api';
import { listNotifications } from '../../../features/notifications/notifications-api';
import type { Notification } from '@campus-skill-exchange/contracts';

const PROFILE_FIELDS = [
  'displayName',
  'department',
  'academicYear',
  'institution',
  'bio',
  'interests',
  'profileImageUrl',
  'githubUrl',
] as const;

function profileCompletion(profile: Profile | null): { done: number; total: number } {
  if (!profile) return { done: 0, total: PROFILE_FIELDS.length };
  const done = PROFILE_FIELDS.filter((field) => {
    const value = profile[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value && String(value).trim());
  }).length;
  return { done, total: PROFILE_FIELDS.length };
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    // Each panel degrades independently: one failing API must not blank the hub.
    const [profileResult, goalResult, sessionResult, notificationResult] = await Promise.allSettled(
      [getCurrentProfile(), listLearningGoals(), listSessions(), listNotifications()],
    );
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    if (goalResult.status === 'fulfilled') setGoals(goalResult.value);
    if (sessionResult.status === 'fulfilled') setSessions(sessionResult.value.items);
    if (notificationResult.status === 'fulfilled') setNotifications(notificationResult.value.items);
    if (profileResult.status === 'rejected') {
      setError('We could not load your profile right now.');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // Dashboard data is read from the authenticated server session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (authLoading) return <Loading label="Checking your session" />;
  if (!user) {
    return (
      <div className="content-stack">
        <Alert severity="info" title="Sign in required">
          Sign in to open your dashboard.
        </Alert>
        <Link className="cse-button cse-button--primary cse-button--md" href="/auth/login">
          Sign in
        </Link>
      </div>
    );
  }
  if (loading) return <Loading label="Loading your dashboard" />;

  const { done, total } = profileCompletion(profile);
  const completion = Math.round((done / total) * 100);
  // NOTE: there is no teaching-preference data in the API yet. Certifications
  // and project technologies are evidence of experience, NOT a statement that
  // the User offers to teach, so they are deliberately not shown here.
  const upcoming = sessions
    .filter((session) => session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS')
    .slice(0, 4);
  const firstName = (profile?.displayName || user.displayName || '').split(' ')[0];

  return (
    <div className="content-stack dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Your learning hub</p>
          <h1>{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</h1>
          <p className="dashboard-hero__sub">
            Track what you are learning, what you can share, and what is coming up.
          </p>
        </div>
        <div className="dashboard-hero__progress">
          <span className="dashboard-hero__progress-value">{completion}%</span>
          <span className="dashboard-hero__progress-label">Profile complete</span>
          <div
            className="dashboard-progress"
            role="progressbar"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <span style={{ width: `${completion}%` }} />
          </div>
        </div>
      </section>

      {error && (
        <Alert severity="error" title="Some data is unavailable">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      )}

      <nav className="dashboard-actions" aria-label="Quick actions">
        {[
          {
            href: '/discover',
            label: 'Find Skill Partners',
            hint: 'Discover people to exchange skills with.',
          },
          { href: '/payments', label: 'My Sessions', hint: 'Review sessions and payments.' },
          {
            href: '/profile',
            label: 'My Profile',
            hint: 'Keep your profile and evidence current.',
          },
          { href: '/chatbot', label: 'AI Assistant', hint: 'Get help preparing for a session.' },
        ].map((action) => (
          <Link key={action.href} className="dashboard-action" href={action.href}>
            <strong>{action.label}</strong>
            <span>{action.hint}</span>
          </Link>
        ))}
      </nav>

      <div className="dashboard-grid">
        <Card title="Skills I want to learn" className="dashboard-card">
          {goals.length === 0 ? (
            <EmptyState
              title="No learning goals yet"
              description="Add a learning goal to track what you want to build next."
            />
          ) : (
            <ul className="dashboard-list">
              {goals.slice(0, 5).map((goal) => (
                <li key={goal.id}>
                  <strong>{goal.skillName}</strong>
                  <span>
                    {goal.currentLevel.toLowerCase()} to {goal.targetLevel.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Skills I can teach" className="dashboard-card">
          <EmptyState
            title="No teaching skills listed yet"
            description="Teaching skills will appear here when your UserSkill teaching preferences are connected."
          />
        </Card>

        <Card title="Upcoming sessions" className="dashboard-card">
          {upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming sessions"
              description="Accepted session requests you schedule will show up here."
            />
          ) : (
            <ul className="dashboard-list">
              {upcoming.map((session) => {
                const other = session.host.userId === user.id ? session.participant : session.host;
                return (
                  <li key={session.id}>
                    <strong>{session.skill?.name ?? 'Skill exchange session'}</strong>
                    <span>
                      {formatWhen(session.scheduledStart)} with {other.displayName}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" className="dashboard-card">
          {notifications.length === 0 ? (
            <EmptyState
              title="No recent activity"
              description="Updates about requests, sessions and payments will appear here."
            />
          ) : (
            <ul className="dashboard-list">
              {notifications.slice(0, 5).map((notification) => (
                <li key={notification.id}>
                  <strong>
                    {notification.title}
                    {!notification.readAt && <Badge tone="info">New</Badge>}
                  </strong>
                  <span>{notification.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
