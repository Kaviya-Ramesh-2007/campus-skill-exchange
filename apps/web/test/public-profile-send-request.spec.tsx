import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPublicProfile: vi.fn(),
  apiRequest: vi.fn(),
  user: { id: '00000000-0000-4000-8000-000000000001', displayName: 'Kaviya Raman' },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ userId: '00000000-0000-4000-8000-000000000002' }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: false }),
}));

vi.mock('../src/features/profile/profile-api', () => ({
  getPublicProfile: mocks.getPublicProfile,
}));

vi.mock('../src/services/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  // The real requests-api module runs on top of this transport double, so the
  // page exercises the actual request-listing and payload-building code.
  apiRequest: (path: string, options: { method?: string; body?: unknown; query?: unknown }) => {
    if (path !== '/requests') throw new Error(`Unexpected request: ${path}`);
    return mocks.apiRequest(path, options);
  },
}));

const PublicProfilePage = (await import('../src/app/(platform)/users/[userId]/profile/page'))
  .default;

const otherProfile = {
  userId: '00000000-0000-4000-8000-000000000002',
  displayName: 'Arun Desai',
  bio: 'Backend engineer who enjoys teaching SQL.',
  department: 'Computer Science',
  academicYear: 'Third year',
  institution: 'Example University',
  interests: ['SQL'],
  githubUrl: null,
  portfolioUrl: null,
  profileImageUrl: null,
  visibility: 'PUBLIC' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PublicProfilePage Send Request action', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.getPublicProfile.mockReset();
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    });
  });

  it('offers Send Request on another User public profile', async () => {
    mocks.getPublicProfile.mockResolvedValue(otherProfile);
    render(<PublicProfilePage />);

    expect(await screen.findByText('Arun Desai')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Send Request' })).toBeInTheDocument();
    // The existing GET /requests contract is what reveals the request state.
    expect(mocks.apiRequest).toHaveBeenCalledWith('/requests', { query: { limit: 50 } });
  });

  it('does not offer Send Request on the current User own profile', async () => {
    mocks.getPublicProfile.mockResolvedValue({ ...otherProfile, userId: mocks.user.id });
    render(<PublicProfilePage />);

    expect(await screen.findByText('Arun Desai')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getPublicProfile).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Send Request' })).not.toBeInTheDocument();
  });
});
