import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '../src/features/notifications/notification-bell';
import type { Notification } from '@campus-skill-exchange/contracts';

const mocks = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock('../src/features/notifications/notifications-api', () => ({
  listNotifications: mocks.listNotifications,
  getUnreadCount: mocks.getUnreadCount,
  markNotificationRead: mocks.markNotificationRead,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
}));

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-000000000002',
    type: 'REQUEST_SENT',
    title: 'New session request',
    message: 'Someone asked to exchange a skill with you.',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function page(items: Notification[]) {
  return { items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } };
}

describe('NotificationBell', () => {
  beforeEach(() => {
    mocks.listNotifications.mockReset();
    mocks.getUnreadCount.mockReset().mockResolvedValue({ unreadCount: 0 });
    mocks.markNotificationRead.mockReset().mockResolvedValue(notification());
    mocks.markAllNotificationsRead.mockReset().mockResolvedValue({ unreadCount: 0 });
  });

  afterEach(() => cleanup());

  it('shows no count badge when everything is read', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(mocks.getUnreadCount).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows the real unread count from the API', async () => {
    mocks.getUnreadCount.mockResolvedValue({ unreadCount: 3 });
    render(<NotificationBell />);
    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows the empty state when there are no notifications', async () => {
    mocks.listNotifications.mockResolvedValue(page([]));
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('You have no notifications yet')).toBeInTheDocument();
  });

  it('shows a safe error state when the API fails', async () => {
    mocks.listNotifications.mockRejectedValue(new Error('raw backend detail'));
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Unable to load notifications right now.')).toBeInTheDocument();
    expect(screen.queryByText('raw backend detail')).not.toBeInTheDocument();
  });

  it('renders real notifications and marks one read on click', async () => {
    mocks.listNotifications.mockResolvedValue(page([notification()]));
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('New session request')).toBeInTheDocument();
    expect(screen.getByText('Someone asked to exchange a skill with you.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('New session request'));
    await waitFor(() => expect(mocks.markNotificationRead).toHaveBeenCalledWith(notification().id));
  });

  it('marks everything read from the panel', async () => {
    mocks.listNotifications.mockResolvedValue(page([notification()]));
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await screen.findByText('New session request');

    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(mocks.markAllNotificationsRead).toHaveBeenCalled());
  });
});
