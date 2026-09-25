import type { Notification, UnreadCount } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export interface NotificationPage {
  items: Notification[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function listNotifications(): Promise<NotificationPage> {
  return apiRequest<NotificationPage>('/notifications', { query: { limit: 20 } });
}

export function getUnreadCount(): Promise<UnreadCount> {
  return apiRequest<UnreadCount>('/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead(): Promise<UnreadCount> {
  return apiRequest<UnreadCount>('/notifications/read-all', { method: 'PATCH' });
}
