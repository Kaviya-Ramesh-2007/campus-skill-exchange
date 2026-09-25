import type { Session } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export function listSessions(): Promise<{ items: Session[] }> {
  return apiRequest<{ items: Session[] }>('/sessions', { query: { limit: 100 } });
}

export function getSession(sessionId: string): Promise<Session> {
  return apiRequest<Session>(`/sessions/${encodeURIComponent(sessionId)}`);
}
