import type { BadgeDefinition, UserBadge } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export function listBadgeDefinitions(): Promise<BadgeDefinition[]> {
  return apiRequest<BadgeDefinition[]>('/badges');
}

export function listUserBadges(userId: string): Promise<UserBadge[]> {
  return apiRequest<UserBadge[]>(`/badges/users/${encodeURIComponent(userId)}`);
}
