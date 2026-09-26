import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestsInbox } from '../src/features/requests/requests-inbox';
import type { SessionRequestsClient } from '../src/features/requests/requests-api';

const CURRENT_USER_ID = '00000000-0000-4000-8000-000000000002';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const incoming = {
  id: '00000000-0000-4000-8000-0000000000bb',
  requester: { userId: '00000000-0000-4000-8000-000000000001', displayName: 'Kaviya Raman' },
  recipient: { userId: CURRENT_USER_ID, displayName: 'Arun Desai' },
  skill: { id: '00000000-0000-4000-8000-000000000003', name: 'SQL' },
  message: 'Could you teach me joins this week?',
  status: 'PENDING' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function stubClient(items: unknown[], overrides: Partial<SessionRequestsClient> = {}) {
  return {
    list: vi.fn().mockResolvedValue({
      items,
      pagination: { page: 1, pageSize: 50, total: items.length, totalPages: 1 },
    }),
    create: vi.fn(),
    decide: vi.fn(),
    ...overrides,
  } as unknown as SessionRequestsClient;
}

describe('RequestsInbox', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.restoreAllMocks());

  it('lists an incoming request so the recipient can accept it', async () => {
    render(<RequestsInbox currentUserId={CURRENT_USER_ID} client={stubClient([incoming])} />);

    expect(await screen.findByText('Incoming request')).toBeInTheDocument();
    expect(screen.getByText('Kaviya Raman')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('accepts an incoming request through the existing PATCH contract', async () => {
    const decide = vi.fn().mockResolvedValue({ ...incoming, status: 'ACCEPTED' });
    const client = stubClient([incoming], { decide });
    render(<RequestsInbox currentUserId={CURRENT_USER_ID} client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(decide).toHaveBeenCalledWith(incoming.id, 'ACCEPTED'));
    expect(await screen.findByText('ACCEPTED')).toBeInTheDocument();
  });

  it('declines an incoming request', async () => {
    const decide = vi.fn().mockResolvedValue({ ...incoming, status: 'DECLINED' });
    const client = stubClient([incoming], { decide });
    render(<RequestsInbox currentUserId={CURRENT_USER_ID} client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(decide).toHaveBeenCalledWith(incoming.id, 'DECLINED'));
    expect(await screen.findByText('DECLINED')).toBeInTheDocument();
  });

  it('lets a requester cancel a request they sent', async () => {
    const outgoing = {
      ...incoming,
      requester: { userId: CURRENT_USER_ID, displayName: 'Arun Desai' },
      recipient: {
        userId: '00000000-0000-4000-8000-000000000001',
        displayName: 'Kaviya Raman',
      },
    };
    const decide = vi.fn().mockResolvedValue({ ...outgoing, status: 'CANCELLED' });
    const client = stubClient([outgoing], { decide });
    render(<RequestsInbox currentUserId={CURRENT_USER_ID} client={client} />);

    expect(await screen.findByText('Request you sent')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));

    await waitFor(() => expect(decide).toHaveBeenCalledWith(outgoing.id, 'CANCELLED'));
  });

  it('shows the empty state when there are no requests', async () => {
    render(<RequestsInbox currentUserId={CURRENT_USER_ID} client={stubClient([])} />);

    expect(await screen.findByText('No session requests yet')).toBeInTheDocument();
  });

  it('explains a rejected decision without leaking backend detail', async () => {
    const decide = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('prisma: P2025 raw detail'), { status: 404, code: 'NOT_FOUND' }),
      );
    const client = stubClient([incoming], { decide });
    render(<RequestsInbox currentUserId={CURRENT_USER_ID} client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('This session request no longer exists.')).toBeInTheDocument();
    expect(screen.queryByText(/prisma/)).not.toBeInTheDocument();
  });
});
