import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../src/app/(platform)/dashboard/page';
import { ApiClientError } from '../src/services/api-client';
import type { AuthUser, Profile } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  listLearningGoals: vi.fn(),
  listSessions: vi.fn(),
  listNotifications: vi.fn(),
  user: null as AuthUser | null,
  authLoading: false,
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: mocks.authLoading }),
}));
vi.mock('../src/features/profile/profile-api', () => ({
  getCurrentProfile: mocks.getCurrentProfile,
}));
vi.mock('../src/features/growth/growth-api', () => ({
  listLearningGoals: mocks.listLearningGoals,
  listProjects: vi.fn(),
  listCertifications: vi.fn(),
}));
vi.mock('../src/features/payments/sessions-api', () => ({ listSessions: mocks.listSessions }));
vi.mock('../src/features/notifications/notifications-api', () => ({
  listNotifications: mocks.listNotifications,
}));

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  displayName: 'Arun Kumar',
} as unknown as AuthUser;

const profile = {
  id: 'p1',
  userId: user.id,
  displayName: 'Arun Kumar',
  department: 'Computer Science',
  academicYear: 'Third year',
  institution: 'Example University',
  bio: 'Systems enthusiast.',
  profileImageUrl: null,
  interests: ['Python'],
  githubUrl: null,
  linkedinUrl: null,
  visibility: 'PUBLIC',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
} as unknown as Profile;

function profileNotFound() {
  return new ApiClientError(404, {
    code: 'PROFILE_NOT_FOUND',
    message: 'No profile exists for this account yet.',
    meta: { requestId: 'req-1' },
  });
}

function seedEmptyPanels() {
  mocks.listLearningGoals.mockResolvedValue([]);
  mocks.listSessions.mockResolvedValue({ items: [] });
  mocks.listNotifications.mockResolvedValue({ items: [] });
}

describe('DashboardPage response handling', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    mocks.user = user;
    mocks.getCurrentProfile.mockReset().mockResolvedValue(profile);
    seedEmptyPanels();
  });

  afterEach(() => cleanup());

  it('renders goals from a real array payload', async () => {
    mocks.listLearningGoals.mockResolvedValue([
      {
        id: 'g1',
        userId: user.id,
        skillId: 's1',
        skillName: 'Advanced Python',
        currentLevel: 'BEGINNER',
        targetLevel: 'ADVANCED',
        description: null,
        priority: 'MEDIUM',
        createdAt: '2026-10-01T12:00:00.000Z',
        updatedAt: '2026-10-01T12:00:00.000Z',
      },
    ]);
    render(<DashboardPage />);
    expect(await screen.findByText('Advanced Python')).toBeInTheDocument();
  });

  it('does not crash when a list endpoint returns a non-array payload', async () => {
    // Regression guard for `goals.slice is not a function`.
    mocks.listLearningGoals.mockResolvedValue({});
    mocks.listSessions.mockResolvedValue({});
    mocks.listNotifications.mockResolvedValue({});

    render(<DashboardPage />);

    expect(await screen.findByText('No learning goals yet')).toBeInTheDocument();
    expect(screen.getByText('No upcoming sessions')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('treats PROFILE_NOT_FOUND as an empty profile rather than an error', async () => {
    mocks.getCurrentProfile.mockRejectedValue(profileNotFound());

    render(<DashboardPage />);

    // Falls back to the account display name when no profile exists yet.
    expect(await screen.findByRole('heading', { name: 'Welcome back, Arun' })).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('We could not load your profile right now.')).not.toBeInTheDocument();
    // Every panel still renders its normal empty state.
    expect(screen.getByText('No learning goals yet')).toBeInTheDocument();
    expect(screen.getByText('No teaching skills listed yet')).toBeInTheDocument();
  });

  it('still reports a genuine profile load failure', async () => {
    mocks.getCurrentProfile.mockRejectedValue(new Error('network down'));

    render(<DashboardPage />);

    expect(
      await screen.findByText('We could not load your profile right now.'),
    ).toBeInTheDocument();
  });

  it('keeps other panels working when only the goals call fails', async () => {
    mocks.listLearningGoals.mockRejectedValue(new Error('boom'));
    render(<DashboardPage />);
    expect(await screen.findByText('No teaching skills listed yet')).toBeInTheDocument();
  });
});
