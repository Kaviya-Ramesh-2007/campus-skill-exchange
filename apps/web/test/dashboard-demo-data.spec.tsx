import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
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

// Mirrors the seeded demo.kaviya account exactly.
const DEMO_USER = {
  id: 'd3m00000-0000-4000-8000-000000000201',
  email: 'demo.kaviya@example.test',
  displayName: 'Kaviya Raman',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: '2026-09-26T09:00:00.000Z',
} as unknown as AuthUser;

const DEMO_PROFILE = {
  id: 'd3m00000-0000-4000-8000-000000000400',
  userId: DEMO_USER.id,
  displayName: 'Kaviya Raman',
  department: 'Computer Science',
  academicYear: 'Third year',
  institution: 'Example Institute of Technology',
  bio: 'Backend developer who enjoys making systems simple and fast.',
  profileImageUrl: null,
  interests: ['Java', 'JavaScript', 'System design'],
  githubUrl: 'https://github.com/example-kaviya',
  portfolioUrl: null,
  visibility: 'PUBLIC',
  createdAt: '2026-09-26T09:00:00.000Z',
  updatedAt: '2026-09-26T09:00:00.000Z',
} as unknown as Profile;

const DEMO_GOALS = [
  {
    id: 'g1',
    userId: DEMO_USER.id,
    skillId: 's-aws',
    skillName: 'AWS',
    currentLevel: 'BEGINNER',
    targetLevel: 'INTERMEDIATE',
    description: null,
    priority: 'MEDIUM',
    createdAt: '2026-09-26T09:00:00.000Z',
    updatedAt: '2026-09-26T09:00:00.000Z',
  },
  {
    id: 'g2',
    userId: DEMO_USER.id,
    skillId: 's-sql',
    skillName: 'SQL',
    currentLevel: 'BEGINNER',
    targetLevel: 'INTERMEDIATE',
    description: null,
    priority: 'MEDIUM',
    createdAt: '2026-09-26T09:00:00.000Z',
    updatedAt: '2026-09-26T09:00:00.000Z',
  },
];

describe('DashboardPage with real seeded demo data', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    mocks.user = DEMO_USER;
    mocks.getCurrentProfile.mockReset().mockResolvedValue(DEMO_PROFILE);
    mocks.listLearningGoals.mockReset().mockResolvedValue(DEMO_GOALS);
    mocks.listSessions.mockReset().mockResolvedValue({ items: [], pagination: {} });
    mocks.listNotifications.mockReset().mockResolvedValue({ items: [], pagination: {} });
  });

  afterEach(() => cleanup());

  it('renders every panel for a seeded demo user', async () => {
    render(<DashboardPage />);
    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Kaviya' }),
    ).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
    expect(screen.getAllByText('beginner to intermediate')).toHaveLength(2);
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Skills I want to learn' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upcoming sessions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent activity' })).toBeInTheDocument();
  });

  it('does not throw during a server-side render', () => {
    // SSR runs without a browser; a browser-only access would throw here.
    expect(() => renderToString(<DashboardPage />)).not.toThrow();
  });

  it('renders when the profile is missing for a new account', async () => {
    mocks.getCurrentProfile.mockRejectedValue(
      new ApiClientError(404, {
        code: 'PROFILE_NOT_FOUND',
        message: 'No profile exists for this account yet.',
        meta: { requestId: 'req-1' },
      }),
    );
    render(<DashboardPage />);
    expect(await screen.findByText('0%')).toBeInTheDocument();
  });
});
