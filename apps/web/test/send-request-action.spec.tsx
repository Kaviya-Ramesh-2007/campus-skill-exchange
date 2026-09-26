import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SendRequestAction } from '../src/features/requests/send-request-action';
import type { SessionRequestsClient } from '../src/features/requests/requests-api';

const CURRENT_USER_ID = '00000000-0000-4000-8000-000000000001';
const RECIPIENT_USER_ID = '00000000-0000-4000-8000-000000000002';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function sessionRequest(overrides: {
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  id?: string;
  message?: string | null;
}) {
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-0000000000aa',
    requester: { userId: CURRENT_USER_ID, displayName: 'Current User' },
    recipient: { userId: RECIPIENT_USER_ID, displayName: 'Arun Desai' },
    skill: null,
    message: overrides.message ?? null,
    status: overrides.status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function stubClient(overrides: Partial<SessionRequestsClient> = {}): SessionRequestsClient {
  return {
    list: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    }),
    create: vi.fn(),
    decide: vi.fn(),
    ...overrides,
  } as SessionRequestsClient;
}

function renderAction(client: SessionRequestsClient) {
  return render(
    <SendRequestAction
      currentUserId={CURRENT_USER_ID}
      recipientUserId={RECIPIENT_USER_ID}
      recipientName="Arun Desai"
      client={client}
    />,
  );
}

describe('SendRequestAction', () => {
  afterEach(() => cleanup());
  beforeEach(() => vi.restoreAllMocks());

  it('shows the Send Request button on another User profile', async () => {
    renderAction(stubClient());

    expect(await screen.findByRole('button', { name: 'Send Request' })).toBeInTheDocument();
    expect(screen.queryByText('Request Pending')).not.toBeInTheDocument();
  });

  it('opens a form with an optional message, Send Request and Cancel', async () => {
    renderAction(stubClient());

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText('Message (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Request' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('submits the optional message and moves straight to Request Pending', async () => {
    const client = stubClient({
      create: vi
        .fn()
        .mockResolvedValue(sessionRequest({ status: 'PENDING', message: 'Can you teach me SQL?' })),
    });
    renderAction(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));
    fireEvent.change(await screen.findByLabelText('Message (optional)'), {
      target: { value: '  Can you teach me SQL?  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => {
      expect(client.create).toHaveBeenCalledWith({
        recipientUserId: RECIPIENT_USER_ID,
        message: 'Can you teach me SQL?',
      });
    });
    expect(await screen.findByText('Request Pending')).toBeInTheDocument();
    // The form is closed and the action is no longer offered, without a refresh.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send Request' })).not.toBeInTheDocument();
  });

  it('omits the message when it is left empty', async () => {
    const client = stubClient({
      create: vi.fn().mockResolvedValue(sessionRequest({ status: 'PENDING' })),
    });
    renderAction(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => {
      expect(client.create).toHaveBeenCalledWith({ recipientUserId: RECIPIENT_USER_ID });
    });
    expect(await screen.findByText('Request Pending')).toBeInTheDocument();
  });

  it('closes the form without sending when Cancel is used', async () => {
    const client = stubClient();
    renderAction(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(client.create).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send Request' })).toBeInTheDocument();
  });

  it('shows Request Pending when an active request already exists', async () => {
    const client = stubClient({
      list: vi.fn().mockResolvedValue({
        items: [sessionRequest({ status: 'PENDING' })],
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
    });
    renderAction(client);

    expect(await screen.findByText('Request Pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send Request' })).not.toBeInTheDocument();
  });

  it('shows Connected when the request was accepted', async () => {
    const client = stubClient({
      list: vi.fn().mockResolvedValue({
        items: [sessionRequest({ status: 'ACCEPTED' })],
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
    });
    renderAction(client);

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send Request' })).not.toBeInTheDocument();
  });

  it('allows a new request after the previous one was declined', async () => {
    const client = stubClient({
      list: vi.fn().mockResolvedValue({
        items: [sessionRequest({ status: 'DECLINED' })],
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
      create: vi.fn().mockResolvedValue(sessionRequest({ status: 'PENDING' })),
    });
    renderAction(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));
    expect(
      await screen.findByText(/Arun Desai declined your previous request/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => expect(client.create).toHaveBeenCalled());
    expect(await screen.findByText('Request Pending')).toBeInTheDocument();
  });

  it('ignores requests between other Users', async () => {
    const other = {
      ...sessionRequest({ status: 'PENDING' }),
      requester: { userId: '00000000-0000-4000-8000-0000000000ff', displayName: 'Someone Else' },
    };
    const client = stubClient({
      list: vi.fn().mockResolvedValue({
        items: [other],
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
    });
    renderAction(client);

    expect(await screen.findByRole('button', { name: 'Send Request' })).toBeInTheDocument();
    expect(screen.queryByText('Request Pending')).not.toBeInTheDocument();
  });

  it('explains a duplicate active request returned by the API', async () => {
    const client = stubClient({
      create: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('An active session request already exists.'), {
            status: 409,
            code: 'CONFLICT',
          }),
        ),
    });
    renderAction(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

    expect(
      await screen.findByText('An active session request already exists with this User.'),
    ).toBeInTheDocument();
    // The form stays open so the User can retry.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('refuses a request to self with a clear message', async () => {
    const client = stubClient({
      create: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('A User cannot request themselves.'), {
            status: 400,
            code: 'VALIDATION_ERROR',
          }),
        ),
    });
    renderAction(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

    expect(
      await screen.findByText('You cannot send a session request to yourself.'),
    ).toBeInTheDocument();
  });

  it('shows a safe error state for a network failure', async () => {
    const client = stubClient({
      create: vi.fn().mockRejectedValue(new Error('socket hang up: internal-host-detail')),
    });
    renderAction(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Send Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

    expect(
      await screen.findByText('Unable to send the session request. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('socket hang up: internal-host-detail')).not.toBeInTheDocument();
  });
});
