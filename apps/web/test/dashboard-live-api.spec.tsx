import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../src/app/(platform)/dashboard/page';
import type { AuthUser } from '@campus-skill-exchange/contracts';

/**
 * Exercises the REAL api-client (envelope unwrapping) against the exact JSON
 * bodies captured from the running API for the seeded demo user. The other
 * dashboard specs mock the feature modules, so this path was never covered.
 */

const USER_ID = '05363b5f-61c7-4a44-bf0c-e1865295ec80';

const mocks = vi.hoisted(() => ({
  user: null as AuthUser | null,
  fetchMock: vi.fn(),
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: false }),
}));

const BODIES: Record<string, unknown> = {
  '/api/v1/profile': {
    success: true,
    data: {
      id: 'd3m00000-0000-4000-8000-000000000400',
      userId: USER_ID,
      displayName: 'Kaviya Raman',
      department: 'Computer Science',
      academicYear: 'Third year',
      institution: 'Example Institute of Technology',
      bio: 'Backend developer.',
      profileImageUrl: null,
      interests: ['Java', 'JavaScript', 'System design'],
      githubUrl: 'https://github.com/example-kaviya',
      portfolioUrl: null,
      visibility: 'PUBLIC',
      createdAt: '2026-09-26T02:20:09.725Z',
      updatedAt: '2026-09-26T02:30:42.020Z',
    },
  },
  // Captured verbatim from the live GET /api/v1/learning-goals response.
  '/api/v1/learning-goals': {
    success: true,
    data: [
      {
        id: '7c8b661e-2127-460c-a66c-d897a98c6e54',
        userId: USER_ID,
        skillId: '5a3866af-669c-47d9-8046-ad579a6362d6',
        currentLevel: 'BEGINNER',
        targetLevel: 'INTERMEDIATE',
        description: null,
        priority: 'MEDIUM',
        createdAt: '2026-09-26T02:20:09.725Z',
        updatedAt: '2026-09-26T02:30:42.020Z',
        skill: { name: 'SQL' },
        skillName: 'SQL',
      },
      {
        id: '3cca1a75-524b-40fc-a4df-158f307c33dc',
        userId: USER_ID,
        skillId: 'c493699f-9bac-4246-9456-5df39ccdc9a7',
        currentLevel: 'BEGINNER',
        targetLevel: 'INTERMEDIATE',
        description: null,
        priority: 'MEDIUM',
        createdAt: '2026-09-26T02:20:09.715Z',
        updatedAt: '2026-09-26T02:30:42.017Z',
        skill: { name: 'AWS' },
        skillName: 'AWS',
      },
    ],
  },
  '/api/v1/sessions': {
    success: true,
    data: { items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } },
  },
  '/api/v1/notifications': {
    success: true,
    data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
  },
};

describe('DashboardPage against real api-client responses', () => {
  beforeEach(() => {
    mocks.user = {
      id: USER_ID,
      email: 'demo.kaviya@example.test',
      displayName: 'Kaviya Raman',
      status: 'ACTIVE',
      roles: ['USER'],
      createdAt: '2026-09-26T02:20:09.725Z',
    } as unknown as AuthUser;

    mocks.fetchMock.mockReset();
    mocks.fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      const key = Object.keys(BODIES).find((path) => url.startsWith(path));
      const body = key ? BODIES[key] : { success: true, data: null };
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => body,
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', mocks.fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the dashboard using the real envelope unwrapping', async () => {
    render(<DashboardPage />);

    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Kaviya' }),
    ).toBeInTheDocument();
    // Rendered from the real goals payload, not a module mock.
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.getByText('AWS')).toBeInTheDocument();
    expect(screen.getAllByText('beginner to intermediate')).toHaveLength(2);
    expect(screen.getByText('No upcoming sessions')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
