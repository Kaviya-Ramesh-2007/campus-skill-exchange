import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../src/app/(platform)/dashboard/page';
import type { LearningGoal, Profile, Session } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  listLearningGoals: vi.fn(),
  listSessions: vi.fn(),
  listNotifications: vi.fn(),
  user: { id: '00000000-0000-4000-8000-000000000001', displayName: 'Arun Kumar' },
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
}));
vi.mock('../src/features/payments/sessions-api', () => ({ listSessions: mocks.listSessions }));
vi.mock('../src/features/notifications/notifications-api', () => ({
  listNotifications: mocks.listNotifications,
}));

const profile: Profile = {
  id: '00000000-0000-4000-8000-000000000002',
  userId: mocks.user.id,
  displayName: 'Arun Kumar',
  department: 'Computer Science',
  academicYear: 'Third year',
  institution: 'Example University',
  bio: 'Interested in systems and databases.',
  profileImageUrl: null,
  interests: ['Python', 'Databases'],
  githubUrl: 'https://github.com/example',
  linkedinUrl: null,
  visibility: 'PUBLIC',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
} as unknown as Profile;

const goal = {
  id: 'g1',
  userId: mocks.user.id,
  skillId: 's1',
  skillName: 'Advanced Python',
  currentLevel: 'BEGINNER',
  targetLevel: 'ADVANCED',
  description: null,
  priority: 'MEDIUM',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
} as LearningGoal;

const session = {
  id: 'sess1',
  sessionRequestId: 'r1',
  host: { userId: 'u2', displayName: 'Priya' },
  participant: { userId: mocks.user.id, displayName: 'Arun Kumar' },
  skill: { id: 's1', name: 'Advanced Python' },
  mode: 'ONLINE',
  status: 'SCHEDULED',
  scheduledStart: '2026-10-04T12:30:00.000Z',
  scheduledEnd: '2026-10-04T13:30:00.000Z',
  timezone: 'Asia/Kolkata',
  meetingUrl: null,
  locationDetails: null,
  googleConferenceStatus: null,
  paymentMode: 'FREE',
  pricePaise: null,
  termsVersion: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
} as Session;

function setupEmpty() {
  mocks.getCurrentProfile.mockResolvedValue(profile);
  mocks.listLearningGoals.mockResolvedValue([]);
  mocks.listSessions.mockResolvedValue({ items: [] });
  mocks.listNotifications.mockResolvedValue({ items: [] });
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    Object.values(mocks).forEach((value) => {
      if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
    });
    setupEmpty();
  });

  afterEach(() => cleanup());

  it('welcomes the signed-in user by first name', async () => {
    render(<DashboardPage />);
    expect(await screen.findByRole('heading', { name: 'Welcome back, Arun' })).toBeInTheDocument();
  });

  it('never labels anyone as a teacher, mentor or student', async () => {
    render(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Welcome back, Arun' });
    for (const word of ['Teacher', 'Mentor', 'Student', 'Tutor', 'Learner']) {
      expect(screen.queryByText(new RegExp(word, 'i'))).not.toBeInTheDocument();
    }
  });

  it('shows real goals, sessions and activity', async () => {
    mocks.listLearningGoals.mockResolvedValue([goal]);
    mocks.listSessions.mockResolvedValue({ items: [session] });
    mocks.listNotifications.mockResolvedValue({
      items: [
        {
          id: 'n1',
          userId: mocks.user.id,
          type: 'REQUEST_ACCEPTED',
          title: 'Session request accepted',
          message: 'Your session request was accepted.',
          readAt: null,
          createdAt: '2026-10-01T12:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    render(<DashboardPage />);

    // "Advanced Python" legitimately appears in both the goals and sessions panels.
    expect((await screen.findAllByText('Advanced Python')).length).toBe(2);
    expect(screen.getByText('Session request accepted')).toBeInTheDocument();
    expect(screen.getByText(/with Priya/)).toBeInTheDocument();
  });

  it('does not claim certifications or projects are teaching skills', async () => {
    render(<DashboardPage />);
    expect(
      await screen.findByText(
        'Teaching skills will appear here when your UserSkill teaching preferences are connected.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Skills I can teach' })).toBeInTheDocument();
  });

  it('shows helpful empty states instead of fake numbers', async () => {
    render(<DashboardPage />);
    expect(await screen.findByText('No learning goals yet')).toBeInTheDocument();
    expect(screen.getByText('No teaching skills listed yet')).toBeInTheDocument();
    expect(screen.getByText('No upcoming sessions')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('shows the profile completion indicator from real profile fields', async () => {
    render(<DashboardPage />);
    const bar = await screen.findByRole('progressbar', { name: 'Profile completion' });
    // 7 of the 8 tracked fields are populated on the fixture (only profileImageUrl is empty).
    expect(bar).toHaveAttribute('aria-valuenow', '88');
  });

  it('offers the four quick actions', async () => {
    render(<DashboardPage />);
    await screen.findByRole('heading', { name: 'Welcome back, Arun' });
    for (const label of ['Find Skill Partners', 'My Sessions', 'My Profile', 'AI Assistant']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('still renders other panels when one API fails', async () => {
    mocks.listLearningGoals.mockRejectedValue(new Error('boom'));
    render(<DashboardPage />);
    expect(await screen.findByText('No teaching skills listed yet')).toBeInTheDocument();
  });
});
