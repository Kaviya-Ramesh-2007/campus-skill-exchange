import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from '../src/app/(platform)/reports/page';
import AdminPage from '../src/app/(platform)/admin/page';
import type { AuthUser } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  user: null as AuthUser | null,
  authLoading: false,
  listReports: vi.fn(),
  createReport: vi.fn(),
  updateReportStatus: vi.fn(),
  getLiveness: vi.fn(),
  getReadiness: vi.fn(),
  getAnalyticsOverview: vi.fn(),
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: mocks.authLoading }),
}));
vi.mock('../src/features/reports/reports-api', () => ({
  listReports: mocks.listReports,
  createReport: mocks.createReport,
  updateReportStatus: mocks.updateReportStatus,
}));
vi.mock('../src/features/admin/admin-api', () => ({
  getLiveness: mocks.getLiveness,
  getReadiness: mocks.getReadiness,
  getAnalyticsOverview: mocks.getAnalyticsOverview,
}));

const LEARNER = '00000000-0000-4000-8000-0000000000b2';
const REPORTED = '00000000-0000-4000-8000-0000000000a1';

const user = {
  id: LEARNER,
  email: 'learner@example.test',
  displayName: 'Arun',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: '2026-10-01T12:00:00.000Z',
} as unknown as AuthUser;
const admin = { ...user, roles: ['USER', 'ADMIN'] } as unknown as AuthUser;

const report = {
  id: '00000000-0000-4000-8000-000000000003',
  reporterUserId: LEARNER,
  reportedUserId: REPORTED,
  category: 'HARASSMENT',
  description: 'This member repeatedly sent abusive messages to me.',
  status: 'OPEN',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  resolvedAt: null,
};

function seedHealth() {
  mocks.getLiveness.mockResolvedValue({
    status: 'ok',
    service: 'campus-skill-exchange-api',
    version: '0.0.0',
    uptimeSeconds: 3720,
    startedAt: '2026-10-01T12:00:00.000Z',
    checkedAt: '2026-10-01T13:02:00.000Z',
    checks: { process: { status: 'up' } },
  });
  mocks.getReadiness.mockResolvedValue({
    status: 'ready',
    service: 'campus-skill-exchange-api',
    checkedAt: '2026-10-01T13:02:00.000Z',
    checks: { database: { status: 'up', latencyMs: 4 } },
  });
  mocks.getAnalyticsOverview.mockResolvedValue({
    totalUsers: 12,
    activeUsers: 10,
    totalSkills: 34,
    totalSessions: 7,
    completedSessions: 3,
    paidSessions: 2,
    totalReports: 4,
    openReports: 1,
  });
}

describe('integration: reports and safety page', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    mocks.user = user;
    mocks.listReports.mockReset().mockResolvedValue([]);
    mocks.createReport.mockReset();
    mocks.updateReportStatus.mockReset();
  });
  afterEach(() => cleanup());

  it('files a real report and lists it with a status badge', async () => {
    mocks.createReport.mockResolvedValue(report);
    render(<ReportsPage />);
    await screen.findByText('You have not filed any reports');

    fireEvent.change(screen.getByPlaceholderText(/Paste the member/), {
      target: { value: REPORTED },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe what happened/), {
      target: { value: report.description },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() =>
      expect(mocks.createReport).toHaveBeenCalledWith({
        reportedUserId: REPORTED,
        category: 'HARASSMENT',
        description: report.description,
      }),
    );
    expect(await screen.findByText('Report submitted')).toBeInTheDocument();
    expect(screen.getByText(report.description)).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('never exposes the admin review panel to a normal USER', async () => {
    mocks.listReports.mockResolvedValue([report]);
    render(<ReportsPage />);
    await screen.findByText(report.description);
    expect(screen.queryByRole('heading', { name: 'Admin review' })).not.toBeInTheDocument();
  });
});

describe('integration: admin authorization across pages', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    seedHealth();
  });
  afterEach(() => cleanup());

  it('withholds all admin content and analytics from a normal USER', async () => {
    mocks.user = user;
    render(<AdminPage />);
    expect(await screen.findByText('Administrator access required')).toBeInTheDocument();
    expect(mocks.getAnalyticsOverview).not.toHaveBeenCalled();
  });

  it('shows real analytics and system status to an ADMIN', async () => {
    mocks.user = admin;
    render(<AdminPage />);
    expect(await screen.findByRole('heading', { name: 'Platform Overview' })).toBeInTheDocument();
    expect(await screen.findByText('Members')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(await screen.findByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });
});
