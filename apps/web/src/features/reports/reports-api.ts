import type { Report, ReportCategory, ReportStatus } from '@campus-skill-exchange/contracts';
import { apiRequest } from '../../services/api-client';

export function listReports(): Promise<Report[]> {
  return apiRequest<Report[]>('/reports');
}

export function createReport(input: {
  reportedUserId: string;
  category: ReportCategory;
  description: string;
}): Promise<Report> {
  return apiRequest<Report>('/reports', { method: 'POST', body: input });
}

export function updateReportStatus(id: string, status: ReportStatus): Promise<Report> {
  return apiRequest<Report>(`/reports/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}
