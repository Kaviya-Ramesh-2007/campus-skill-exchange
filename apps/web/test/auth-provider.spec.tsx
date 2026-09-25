import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../src/features/auth/auth-provider';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('../src/services/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    readonly status: number;

    constructor(status: number) {
      super('API request failed');
      this.status = status;
    }
  },
  apiRequest: mocks.apiRequest,
}));

function AuthProbe() {
  const { isLoading, user } = useAuth();
  return <div>{isLoading ? 'loading' : (user?.email ?? 'signed-out')}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('hydrates the user from the server current-user response', async () => {
    mocks.apiRequest.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'ada@example.test',
      displayName: 'Ada Lovelace',
      status: 'ACTIVE',
      roles: ['USER'],
      createdAt: '2026-09-24T00:00:00.000Z',
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('ada@example.test')).toBeInTheDocument();
    expect(mocks.apiRequest).toHaveBeenCalledWith('/auth/me');
  });
});
