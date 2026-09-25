import type { AnalyticsOverview } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

/** ADMIN-only. Real PostgreSQL aggregates; the API refuses non-admins. */
export function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return apiRequest<AnalyticsOverview>('/analytics/overview');
}

/** Real infrastructure data from the existing public health endpoints. */
export interface LivenessReport {
  status: 'ok' | 'error';
  service: string;
  version: string;
  uptimeSeconds: number;
  startedAt: string;
  checkedAt: string;
  checks: { process: { status: 'up' | 'down' } };
}

export interface ReadinessReport {
  status: 'ready' | 'not_ready';
  service: string;
  checkedAt: string;
  checks: { database: { status: 'up' | 'down'; latencyMs?: number } };
}

export function getLiveness(): Promise<LivenessReport> {
  return apiRequest<LivenessReport>('/health');
}

export function getReadiness(): Promise<ReadinessReport> {
  return apiRequest<ReadinessReport>('/ready');
}
