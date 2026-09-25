import type {
  EventEnvelope,
  Report,
  ReportCategory,
  ReportEventPayload,
} from '@campus-skill-exchange/contracts';

export const REPORTS_REPOSITORY = Symbol('REPORTS_REPOSITORY');

export type ReportRecord = Omit<Report, 'createdAt' | 'updatedAt' | 'resolvedAt'> & {
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

export interface ReportsRepository {
  reportedUserExists(userId: string): Promise<boolean>;
  create(
    id: string,
    reporterUserId: string,
    reportedUserId: string,
    category: ReportCategory,
    description: string,
    event: EventEnvelope<ReportEventPayload>,
  ): Promise<ReportRecord>;
  /** Own reports for a USER; every report for an ADMIN. */
  list(viewerUserId: string, isAdmin: boolean): Promise<ReportRecord[]>;
  findById(id: string): Promise<ReportRecord | null>;
  updateStatus(id: string, status: ReportRecord['status']): Promise<ReportRecord>;
}

export class ReportNotFoundError extends Error {
  constructor() {
    super('The report was not found.');
    this.name = 'ReportNotFoundError';
  }
}
