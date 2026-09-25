import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BadgesPage from '../src/app/(platform)/badges/page';
import { BadgeCard } from '../src/features/badges/badge-card';

const mocks = vi.hoisted(() => ({
  listBadgeDefinitions: vi.fn(),
  listUserBadges: vi.fn(),
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    displayName: 'Badge User',
  },
  authLoading: false,
}));

vi.mock('../src/features/badges/badges-api', () => ({
  listBadgeDefinitions: mocks.listBadgeDefinitions,
  listUserBadges: mocks.listUserBadges,
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: mocks.authLoading }),
}));

const definition = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'First Session',
  description: 'Completed a first learning session.',
  code: 'FIRST_SESSION',
  iconUrl: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
};
const availableDefinition = {
  ...definition,
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Helpful Peer',
  description: 'Helped another User learn.',
  code: 'HELPFUL_PEER',
};
const earnedBadge = {
  id: '00000000-0000-4000-8000-000000000004',
  userId: mocks.user.id,
  badgeDefinitionId: definition.id,
  awardedAt: '2026-10-01T12:00:00.000Z',
  badgeDefinition: definition,
};

describe('BadgesPage', () => {
  beforeEach(() => {
    mocks.authLoading = false;
    mocks.listBadgeDefinitions.mockReset();
    mocks.listUserBadges.mockReset();
  });

  afterEach(() => cleanup());

  it('shows a loading state while badge data is loading', () => {
    mocks.listBadgeDefinitions.mockReturnValue(new Promise(() => {}));
    mocks.listUserBadges.mockReturnValue(new Promise(() => {}));

    render(<BadgesPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading your badges');
  });

  it('shows an empty state when no badges are earned', async () => {
    mocks.listBadgeDefinitions.mockResolvedValue([]);
    mocks.listUserBadges.mockResolvedValue([]);

    render(<BadgesPage />);

    expect(await screen.findByText('No badges earned yet')).toBeInTheDocument();
  });

  it('shows a safe error state when the API fails', async () => {
    mocks.listBadgeDefinitions.mockRejectedValue(new Error('raw backend detail'));
    mocks.listUserBadges.mockResolvedValue([]);

    render(<BadgesPage />);

    expect(
      await screen.findByText('Unable to load badges right now. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('raw backend detail')).not.toBeInTheDocument();
  });

  it('renders earned and available badges from the API', async () => {
    mocks.listBadgeDefinitions.mockResolvedValue([definition, availableDefinition]);
    mocks.listUserBadges.mockResolvedValue([earnedBadge]);

    render(<BadgesPage />);

    expect(await screen.findByRole('heading', { name: 'First Session' })).toBeInTheDocument();
    expect(screen.getByText('Completed a first learning session.')).toBeInTheDocument();
    expect(screen.getByText('Awarded', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Available badges' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Helpful Peer' })).toBeInTheDocument();
    expect(mocks.listUserBadges).toHaveBeenCalledWith(mocks.user.id);
    expect(screen.queryByRole('button', { name: /award/i })).not.toBeInTheDocument();
  });
});

describe('BadgeCard', () => {
  it('renders a badge name, description, and awarded date', () => {
    render(<BadgeCard badge={definition} awardedAt="2026-10-01T12:00:00.000Z" />);

    expect(screen.getByRole('heading', { name: 'First Session' })).toBeInTheDocument();
    expect(screen.getByText('Completed a first learning session.')).toBeInTheDocument();
    expect(screen.getByText('Earned')).toBeInTheDocument();
    expect(screen.getByText(/Oct 1, 2026/)).toBeInTheDocument();
  });
});
