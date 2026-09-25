import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPage from '../src/app/(platform)/admin/page';
import { AdminNavigationLink } from '../src/features/admin/admin-navigation-link';
import type { AuthUser } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  getLiveness: vi.fn(),
  getReadiness: vi.fn(),
  getAnalyticsOverview: vi.fn(),
  user: null as AuthUser | null,
  authLoading: false,
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: mocks.authLoading }),
}));
vi.mock('../src/features/admin/admin-api', () => ({
  getLiveness: mocks.getLiveness,
  getReadiness: mocks.getReadiness,
  getAnalyticsOverview: mocks.getAnalyticsOverview,
}));

const baseUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.test',
  displayName: 'Priya Raman',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: '2026-10-01T12:00:00.000Z',
} as unknown as AuthUser;

const adminUser = { ...baseUser, roles: ['USER', 'ADMIN'] } as AuthUser;

const liveness = {
  status: 'ok',
  service: 'campus-skill-exchange-api',
  version: '0.0.0',
  uptimeSeconds: 3720,
  startedAt: '2026-10-01T12:00:00.000Z',
  checkedAt: '2026-10-01T13:02:00.000Z',
  checks: { process: { status: 'up' } },
};

const readiness = {
  status: 'ready',
  service: 'campus-skill-exchange-api',
  checkedAt: '2026-10-01T13:02:00.000Z',
  checks: { database: { status: 'up', latencyMs: 4 } },
};

function setupHealth() {
  mocks.getLiveness.mockResolvedValue(liveness);
  mocks.getReadiness.mockResolvedValue(readiness);
}

describe('AdminPage', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    mocks.getLiveness.mockReset();
    mocks.getReadiness.mockReset();
    mocks.getAnalyticsOverview.mockReset().mockResolvedValue({
      totalUsers: 12,
      activeUsers: 10,
      totalSkills: 34,
      totalSessions: 7,
      completedSessions: 3,
      paidSessions: 2,
      totalReports: 4,
      openReports: 1,
    });
    mocks.user = adminUser;
    setupHealth();
  });

  afterEach(() => cleanup());

  it('shows the control center and admin identity to an ADMIN', async () => {
    render(<AdminPage />);
    expect(screen.getByRole('heading', { name: 'Admin Control Center' })).toBeInTheDocument();
    expect(await screen.findByText('Priya Raman')).toBeInTheDocument();
  });

  it('hides all admin content from a normal USER', async () => {
    mocks.user = baseUser;
    render(<AdminPage />);
    expect(await screen.findByText('Administrator access required')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Admin Control Center' })).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('System status')).not.toBeInTheDocument();
  });

  it('hides all admin content from a signed-out visitor', async () => {
    mocks.user = null;
    render(<AdminPage />);
    expect(await screen.findByText('Sign in required')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('marks unfinished areas as coming soon without showing fake data', async () => {
    render(<AdminPage />);
    expect(await screen.findAllByText('Coming soon')).toHaveLength(3);
    expect(screen.getByText('Reports & Safety')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('System Activity')).toBeInTheDocument();
    // A finished area is the only real link, and there is no invented data.
    expect(screen.getByRole('link', { name: /Users/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Analytics/ })).not.toBeInTheDocument();
  });

  it('shows the real Platform Overview counters for an ADMIN', async () => {
    render(<AdminPage />);
    expect(await screen.findByRole('heading', { name: 'Platform Overview' })).toBeInTheDocument();
    expect(await screen.findByText('Members')).toBeInTheDocument();
    expect(await screen.findByText('34')).toBeInTheDocument();
    expect(mocks.getAnalyticsOverview).toHaveBeenCalled();
  });

  it('never requests analytics for a normal USER', async () => {
    mocks.user = baseUser;
    render(<AdminPage />);
    expect(await screen.findByText('Administrator access required')).toBeInTheDocument();
    expect(mocks.getAnalyticsOverview).not.toHaveBeenCalled();
    expect(screen.queryByText('Platform Overview')).not.toBeInTheDocument();
  });

  it('shows an error state instead of fake numbers when analytics fail', async () => {
    mocks.getAnalyticsOverview.mockRejectedValue(new Error('boom'));
    render(<AdminPage />);
    expect(
      await screen.findByText('Platform analytics are unavailable right now.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('34')).not.toBeInTheDocument();
  });

  it('reports real system status from the health endpoints', async () => {
    render(<AdminPage />);
    expect(await screen.findByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
    expect(mocks.getLiveness).toHaveBeenCalled();
    expect(mocks.getReadiness).toHaveBeenCalled();
  });

  it('does not invent a healthy status when the health API fails', async () => {
    mocks.getLiveness.mockRejectedValue(new Error('down'));
    mocks.getReadiness.mockRejectedValue(new Error('down'));
    render(<AdminPage />);
    expect(await screen.findByText('System status is unavailable right now.')).toBeInTheDocument();
    expect(screen.queryByText('Operational')).not.toBeInTheDocument();
  });
});

describe('AdminNavigationLink', () => {
  beforeEach(() => {
    mocks.authLoading = false;
  });
  afterEach(() => cleanup());

  it('shows the admin link only to an ADMIN', () => {
    mocks.user = adminUser;
    const { unmount } = render(<AdminNavigationLink />);
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    unmount();

    mocks.user = baseUser;
    render(<AdminNavigationLink />);
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });
});
