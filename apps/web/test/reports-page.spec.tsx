import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from '../src/app/(platform)/reports/page';
import type { AuthUser, Report } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  listReports: vi.fn(),
  createReport: vi.fn(),
  updateReportStatus: vi.fn(),
  user: null as AuthUser | null,
  authLoading: false,
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: mocks.authLoading }),
}));
vi.mock('../src/features/reports/reports-api', () => ({
  listReports: mocks.listReports,
  createReport: mocks.createReport,
  updateReportStatus: mocks.updateReportStatus,
}));

const reporterId = '00000000-0000-4000-8000-000000000001';
const reportedId = '00000000-0000-4000-8000-000000000002';

const baseUser = {
  id: reporterId,
  email: 'user@example.test',
  displayName: 'Arun',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: '2026-10-01T12:00:00.000Z',
} as unknown as AuthUser;
const adminUser = { ...baseUser, roles: ['USER', 'ADMIN'] } as AuthUser;

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: '00000000-0000-4000-8000-000000000003',
    reporterUserId: reporterId,
    reportedUserId: reportedId,
    category: 'HARASSMENT',
    description: 'This member repeatedly sent abusive messages to me.',
    status: 'OPEN',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    resolvedAt: null,
    ...overrides,
  };
}

describe('ReportsPage', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    mocks.user = baseUser;
    mocks.listReports.mockReset().mockResolvedValue([]);
    mocks.createReport.mockReset();
    mocks.updateReportStatus.mockReset();
  });

  afterEach(() => cleanup());

  it('requires sign in', async () => {
    mocks.user = null;
    render(<ReportsPage />);
    expect(await screen.findByText('Sign in required')).toBeInTheDocument();
  });

  it('shows an empty state with no fake reports', async () => {
    render(<ReportsPage />);
    expect(await screen.findByText('You have not filed any reports')).toBeInTheDocument();
  });

  it('shows a safe error state when the API fails', async () => {
    mocks.listReports.mockRejectedValue(new Error('raw detail'));
    render(<ReportsPage />);
    expect(await screen.findByText('Unable to load reports right now.')).toBeInTheDocument();
    expect(screen.queryByText('raw detail')).not.toBeInTheDocument();
  });

  it('submits a real report and shows it with a status badge', async () => {
    mocks.createReport.mockResolvedValue(report());
    render(<ReportsPage />);
    await screen.findByText('You have not filed any reports');

    fireEvent.change(screen.getByPlaceholderText(/Paste the member/), {
      target: { value: reportedId },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe what happened/), {
      target: { value: 'This member repeatedly sent abusive messages to me.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    await waitFor(() =>
      expect(mocks.createReport).toHaveBeenCalledWith({
        reportedUserId: reportedId,
        category: 'HARASSMENT',
        description: 'This member repeatedly sent abusive messages to me.',
      }),
    );
    expect(await screen.findByText('Report submitted')).toBeInTheDocument();
    // "Harassment or abuse" is also the selected <option>, so match the list item.
    expect(
      screen.getByText('This member repeatedly sent abusive messages to me.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('keeps submit disabled until the form is valid', async () => {
    render(<ReportsPage />);
    await screen.findByText('You have not filed any reports');
    const submit = screen.getByRole('button', { name: 'Submit report' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Paste the member/), {
      target: { value: reportedId },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Describe what happened/), {
      target: { value: 'short' },
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Describe what happened/), {
      target: { value: 'This member repeatedly sent abusive messages to me.' },
    });
    expect(submit).toBeEnabled();
  });

  it('hides the admin review panel from a normal USER', async () => {
    render(<ReportsPage />);
    await screen.findByText('You have not filed any reports');
    expect(screen.queryByRole('heading', { name: 'Admin review' })).not.toBeInTheDocument();
  });

  it('lets an ADMIN review and update report status', async () => {
    mocks.user = adminUser;
    mocks.listReports.mockResolvedValue([report()]);
    mocks.updateReportStatus.mockResolvedValue(report({ status: 'RESOLVED' }));

    render(<ReportsPage />);
    expect(await screen.findByRole('heading', { name: 'Admin review' })).toBeInTheDocument();

    fireEvent.change(screen.getAllByLabelText('Update status')[0]!, {
      target: { value: 'RESOLVED' },
    });

    await waitFor(() => expect(mocks.updateReportStatus).toHaveBeenCalled());
    expect(mocks.updateReportStatus).toHaveBeenCalledWith(report().id, 'RESOLVED');
    // "Resolved" appears as a badge in both panels plus the <option> in the status select.
    await waitFor(() => expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(2));
  });
});
