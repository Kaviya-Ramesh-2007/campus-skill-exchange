import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrimaryNavigation } from '../src/features/navigation/primary-navigation';
import type { AuthUser } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  user: null as AuthUser | null,
  pathname: '/dashboard',
}));

vi.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.user, isLoading: false }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

const user = { id: 'u1', roles: ['USER'] } as unknown as AuthUser;
const admin = { id: 'u1', roles: ['USER', 'ADMIN'] } as unknown as AuthUser;

describe('PrimaryNavigation', () => {
  beforeEach(() => {
    mocks.user = user;
    mocks.pathname = '/dashboard';
  });
  afterEach(() => cleanup());

  it('marks the current page with aria-current and an active style', () => {
    render(<PrimaryNavigation />);
    const current = screen.getByRole('link', { name: 'Dashboard' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.className).toContain('site-nav__link--active');
    expect(screen.getByRole('link', { name: 'Discover' })).not.toHaveAttribute('aria-current');
  });

  it('marks a nested route as active for its section', () => {
    mocks.pathname = '/profile/edit';
    render(<PrimaryNavigation />);
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('marks no nav item on a detail route outside the primary sections', () => {
    mocks.pathname = '/sessions/abc-123';
    render(<PrimaryNavigation />);
    for (const label of ['Home', 'Dashboard', 'Discover', 'Payments']) {
      expect(screen.getByRole('link', { name: label })).not.toHaveAttribute('aria-current');
    }
  });

  it('never renders the admin link for a normal USER', () => {
    render(<PrimaryNavigation />);
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('renders and activates the admin link for an ADMIN', () => {
    mocks.user = admin;
    mocks.pathname = '/admin';
    render(<PrimaryNavigation />);
    const link = screen.getByRole('link', { name: 'Admin' });
    expect(link).toHaveAttribute('href', '/admin');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('keeps Home active only on the home route', () => {
    mocks.pathname = '/';
    render(<PrimaryNavigation />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });
});
