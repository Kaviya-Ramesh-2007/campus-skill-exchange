import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiscoverPage from '../src/app/(platform)/discover/page';

const mocks = vi.hoisted(() => ({
  searchDiscoveryUsers: vi.fn(),
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Current User',
  },
}));

vi.mock('../src/features/discovery/discovery-api', () => ({
  searchDiscoveryUsers: mocks.searchDiscoveryUsers,
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: false }),
}));

vi.mock('../src/services/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const result = {
  items: [
    {
      userId: '00000000-0000-4000-8000-000000000002',
      displayName: 'Grace Hopper',
      profileImageUrl: null,
      department: 'Computer Science',
      institution: 'Example University',
      bio: 'Builds useful things.',
      skills: [
        {
          id: '00000000-0000-4000-8000-000000000003',
          name: 'Java',
          proficiency: 'EXPERT',
          description: null,
        },
      ],
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('DiscoverPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.searchDiscoveryUsers.mockReset();
  });

  it('searches the Discovery API and links to the public profile', async () => {
    mocks.searchDiscoveryUsers.mockResolvedValue(result);
    render(<DiscoverPage />);

    fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Java' } });
    fireEvent.change(screen.getByLabelText('Search Users or skills'), { target: { value: 'web' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(mocks.searchDiscoveryUsers).toHaveBeenCalledWith({
        skill: 'Java',
        search: 'web',
        page: 1,
        limit: 20,
      });
    });
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute(
      'href',
      '/users/00000000-0000-4000-8000-000000000002/profile',
    );
  });

  it('shows the empty state when no Users are returned', async () => {
    mocks.searchDiscoveryUsers.mockResolvedValue({ ...result, items: [] });
    render(<DiscoverPage />);
    fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Unknown' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No Users found')).toBeInTheDocument();
  });

  it('shows a safe error state when the API fails', async () => {
    mocks.searchDiscoveryUsers.mockRejectedValue(new Error('raw backend detail'));
    render(<DiscoverPage />);
    fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Java' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Unable to load Users. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('raw backend detail')).not.toBeInTheDocument();
  });

  it('requests the next page when Next is selected', async () => {
    mocks.searchDiscoveryUsers
      .mockResolvedValueOnce({
        ...result,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        ...result,
        pagination: { page: 2, limit: 20, total: 2, totalPages: 2 },
      });
    render(<DiscoverPage />);
    fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'Java' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText('Grace Hopper');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(mocks.searchDiscoveryUsers).toHaveBeenLastCalledWith({
        skill: 'Java',
        page: 2,
        limit: 20,
      });
    });
  });
});
