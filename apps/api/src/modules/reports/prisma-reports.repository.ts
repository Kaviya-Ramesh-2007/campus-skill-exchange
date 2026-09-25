import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  EventEnvelope,
  ReportCategory,
  ReportEventPayload,
} from '@campus-skill-exchange/contracts';
import { PrismaService } from '../../platform/database/prisma.service';
import { OUTBOX_WRITER, type OutboxWriter } from '../../platform/events/outbox-contracts';
import { type ReportRecord, type ReportsRepository } from './reports.types';

@Injectable()
export class PrismaReportsRepository implements ReportsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OUTBOX_WRITER) private readonly outboxWriter: OutboxWriter,
  ) {}

  async reportedUserExists(userId: string): Promise<boolean> {
    const found = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { id: true },
    });
    return found !== null;
  }

  async create(
    id: string,
    reporterUserId: string,
    reportedUserId: string,
    category: ReportCategory,
    description: string,
    event: EventEnvelope<ReportEventPayload>,
  ): Promise<ReportRecord> {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.report.create({
        data: { id, reporterUserId, reportedUserId, category, description, status: 'OPEN' },
      });
      await this.outboxWriter.enqueue(event, tx);
      return created;
    });
    return this.mapReport(row);
  }

  async list(viewerUserId: string, isAdmin: boolean): Promise<ReportRecord[]> {
    const rows = await this.prisma.report.findMany({
      // A USER only ever sees what they filed; an ADMIN sees every report.
      where: isAdmin ? {} : { reporterUserId: viewerUserId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((row) => this.mapReport(row));
  }

  async findById(id: string): Promise<ReportRecord | null> {
    const row = await this.prisma.report.findUnique({ where: { id } });
    return row ? this.mapReport(row) : null;
  }

  async updateStatus(id: string, status: ReportRecord['status']): Promise<ReportRecord> {
    const row = await this.prisma.report.update({
      where: { id },
      data: {
        status,
        // Only a settled report carries a resolution timestamp.
        resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? new Date() : null,
      },
    });
    return this.mapReport(row);
  }

  private mapReport(row: {
    id: string;
    reporterUserId: string;
    reportedUserId: string;
    category: ReportCategory;
    description: string;
    status: ReportRecord['status'];
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  }): ReportRecord {
    return {
      id: row.id,
      reporterUserId: row.reporterUserId,
      reportedUserId: row.reportedUserId,
      category: row.category,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
    };
  }
}

export function newReportId(): string {
  return randomUUID();
}
