'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, EmptyState, Loading } from '@campus-skill-exchange/ui';
import type { Notification } from '@campus-skill-exchange/contracts';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications-api';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const loadCount = useCallback(async () => {
    try {
      const result = await getUnreadCount();
      setUnreadCount(result.unreadCount);
    } catch {
      // The badge is not important enough to interrupt the User over.
    }
  }, []);

  const loadPanel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listNotifications();
      setNotifications(page.items);
      setUnreadCount(page.items.filter((item) => !item.readAt).length);
    } catch {
      setError('Unable to load notifications right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Unread count is refreshed on mount from the authenticated server session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCount();
  }, [loadCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next) void loadPanel();
  }

  async function handleRead(notification: Notification) {
    if (notification.readAt) return;
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      // Re-sync with the server rather than trusting local state.
      void loadPanel();
    }
  }

  async function handleReadAll() {
    setNotifications((items) =>
      items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      void loadPanel();
    }
  }

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="notification-bell__trigger"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={togglePanel}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && <span className="notification-bell__count">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel" role="region" aria-label="Notifications">
          <div className="notification-panel__header">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void handleReadAll()}>
                Mark all as read
              </Button>
            )}
          </div>

          {loading && <Loading label="Loading notifications" />}
          {!loading && error && (
            <Alert severity="error" title="Notifications unavailable">
              {error}{' '}
              <Button variant="secondary" size="sm" onClick={() => void loadPanel()}>
                Try again
              </Button>
            </Alert>
          )}
          {!loading && !error && notifications.length === 0 && (
            <EmptyState
              title="You have no notifications yet"
              description="Session, request, payment and badge updates will show up here."
            />
          )}
          {!loading && !error && notifications.length > 0 && (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li key={notification.id} className="notification-item">
                  <button
                    type="button"
                    className={`notification-item__button${notification.readAt ? '' : ' notification-item__button--unread'}`}
                    onClick={() => void handleRead(notification)}
                    disabled={Boolean(notification.readAt)}
                  >
                    <span className="notification-item__title">
                      {notification.title}
                      {!notification.readAt && <Badge tone="info">New</Badge>}
                    </span>
                    <span className="notification-item__message">{notification.message}</span>
                    <span className="notification-item__time">
                      {relativeTime(notification.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
