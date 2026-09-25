import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  createReportSchema,
  reportCreatedEventDefinition,
  updateReportStatusSchema,
  type AuthUser,
  type EventEnvelope,
  type Report,
  type ReportEventPayload,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AUTHORIZATION_POLICY, type AuthorizationPolicy } from '../../platform/auth/auth-contracts';
import { REPORTS_REPOSITORY, type ReportRecord, type ReportsRepository } from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(REPORTS_REPOSITORY) private readonly repository: ReportsRepository,
    @Inject(AUTHORIZATION_POLICY) private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async create(actor: AuthUser, input: unknown): Promise<Report> {
    const data = this.parse(createReportSchema, input);
    if (data.reportedUserId === actor.id) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'You cannot report yourself.');
    }
    if (!(await this.repository.reportedUserExists(data.reportedUserId))) {
      throw new ApiException(404, 'NOT_FOUND', 'The reported User was not found.');
    }

    const id = randomUUID();
    const report = await this.repository.create(
      id,
      actor.id,
      data.reportedUserId,
      data.category,
      data.description,
      this.createdEvent(id, actor.id, data.reportedUserId, data.category),
    );
    return this.toResponse(report);
  }

  /** A USER sees only their own reports; an ADMIN sees every report. */
  async list(actor: AuthUser): Promise<Report[]> {
    const isAdmin = this.isAdmin(actor);
    const rows = await this.repository.list(actor.id, isAdmin);
    return rows.map((row) => this.toResponse(row));
  }

  /** Only an ADMIN may move a report through its lifecycle. */
  async updateStatus(actor: AuthUser, reportId: string, input: unknown): Promise<Report> {
    const data = this.parse(updateReportStatusSchema, input);
    if (!this.isAdmin(actor)) {
      throw new ApiException(403, 'AUTH_FORBIDDEN', 'Only an ADMIN can change a report status.');
    }
    const existing = await this.repository.findById(reportId);
    if (!existing) throw new ApiException(404, 'NOT_FOUND', 'The report was not found.');
    return this.toResponse(await this.repository.updateStatus(reportId, data.status));
  }

  private isAdmin(actor: AuthUser): boolean {
    return this.authorizationPolicy.can({
      request: { identity: this.identityFor(actor) },
      action: 'moderate',
      resourceType: 'Report',
    });
  }

  private identityFor(actor: AuthUser) {
    return {
      userId: actor.id,
      issuer: 'campus-skill-exchange',
      subject: actor.id,
      roles: actor.roles,
      claims: {},
    };
  }

  private createdEvent(
    reportId: string,
    reporterUserId: string,
    reportedUserId: string,
    category: ReportEventPayload['category'],
  ): EventEnvelope<ReportEventPayload> {
    const eventId = randomUUID();
    return {
      eventId,
      eventType: reportCreatedEventDefinition.name,
      version: reportCreatedEventDefinition.version,
      occurredAt: new Date().toISOString(),
      actorId: reporterUserId,
      entityType: 'Report',
      entityId: reportId,
      correlationId: null,
      causationId: null,
      idempotencyKey: `report-created:${reportId}:${eventId}`,
      payload: {
        reportId,
        reporterUserId,
        reportedUserId,
        category,
        status: 'OPEN',
      },
    };
  }

  private toResponse(record: ReportRecord): Report {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
    };
  }

  private parse<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success || result.data === undefined) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    }
    return result.data;
  }
}
