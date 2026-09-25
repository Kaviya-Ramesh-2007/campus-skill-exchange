import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';
import { ReportsService } from '../src/modules/reports/reports.service';
import type { ReportRecord, ReportsRepository } from '../src/modules/reports/reports.types';
import type { AuthUser, EventEnvelope, ReportEventPayload } from '@campus-skill-exchange/contracts';

const reporterId = '00000000-0000-4000-8000-000000000001';
const reportedId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const now = new Date('2026-10-01T12:00:00.000Z');

const user: AuthUser = {
  id: reporterId,
  email: 'user@example.test',
  displayName: 'Arun',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: now.toISOString(),
} as unknown as AuthUser;
const admin = { ...user, id: otherId, roles: ['USER', 'ADMIN'] } as unknown as AuthUser;

function report(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    id: '00000000-0000-4000-8000-000000000004',
    reporterUserId: reporterId,
    reportedUserId: reportedId,
    category: 'HARASSMENT',
    description: 'This member repeatedly sent abusive messages.',
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    ...overrides,
  };
}

class FakeReportsRepository implements ReportsRepository {
  rows: ReportRecord[] = [];
  knownUsers = new Set([reporterId, reportedId, otherId]);
  events: EventEnvelope<ReportEventPayload>[] = [];

  async reportedUserExists(userId: string) {
    return this.knownUsers.has(userId);
  }
  async create(
    id: string,
    r: string,
    reported: string,
    category: ReportRecord['category'],
    description: string,
    event: EventEnvelope<ReportEventPayload>,
  ) {
    const row = report({ id, reporterUserId: r, reportedUserId: reported, category, description });
    this.rows.push(row);
    this.events.push(event);
    return row;
  }
  async list(viewerUserId: string, isAdmin: boolean) {
    return isAdmin ? this.rows : this.rows.filter((r) => r.reporterUserId === viewerUserId);
  }
  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async updateStatus(id: string, status: ReportRecord['status']) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('missing');
    row.status = status;
    return row;
  }
}

function setup() {
  const repository = new FakeReportsRepository();
  const service = new ReportsService(repository, new SystemRoleAuthorizationPolicy());
  return { repository, service };
}

const validInput = {
  reportedUserId: reportedId,
  category: 'HARASSMENT' as const,
  description: 'This member repeatedly sent abusive messages to me.',
};

describe('ReportsService', () => {
  it('files a report and publishes REPORT_CREATED', async () => {
    const { service, repository } = setup();
    const result = await service.create(user, validInput);

    expect(result).toMatchObject({ status: 'OPEN', category: 'HARASSMENT' });
    expect(result.resolvedAt).toBeNull();
    expect(repository.events[0]).toMatchObject({ eventType: 'REPORT_CREATED' });
    expect(repository.events[0]?.payload).toMatchObject({
      reporterUserId: reporterId,
      reportedUserId: reportedId,
      status: 'OPEN',
    });
  });

  it('prevents self-reporting', async () => {
    const { service, repository } = setup();
    await expect(
      service.create(user, { ...validInput, reportedUserId: reporterId }),
    ).rejects.toBeInstanceOf(ApiException);
    expect(repository.rows).toHaveLength(0);
  });

  it('rejects an unknown reported User and a too-short description', async () => {
    const { service } = setup();
    await expect(
      service.create(user, {
        ...validInput,
        reportedUserId: '00000000-0000-4000-8000-000000000009',
      }),
    ).rejects.toBeInstanceOf(ApiException);
    await expect(
      service.create(user, { ...validInput, description: 'too short' }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects an unsupported category', async () => {
    const { service } = setup();
    await expect(
      service.create(user, { ...validInput, category: 'NOT_A_CATEGORY' }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('shows a USER only their own reports', async () => {
    const { service, repository } = setup();
    repository.rows = [
      report({ id: 'a', reporterUserId: reporterId }),
      report({ id: 'b', reporterUserId: otherId }),
    ];
    const mine = await service.list(user);
    expect(mine.map((r) => r.id)).toEqual(['a']);
  });

  it('shows an ADMIN every report', async () => {
    const { service, repository } = setup();
    repository.rows = [
      report({ id: 'a', reporterUserId: reporterId }),
      report({ id: 'b', reporterUserId: otherId }),
    ];
    const all = await service.list(admin);
    expect(all.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('lets only an ADMIN change a report status', async () => {
    const { service, repository } = setup();
    repository.rows = [report({ id: 'a' })];

    await expect(service.updateStatus(user, 'a', { status: 'RESOLVED' })).rejects.toBeInstanceOf(
      ApiException,
    );
    expect(repository.rows[0]?.status).toBe('OPEN');

    const updated = await service.updateStatus(admin, 'a', { status: 'UNDER_REVIEW' });
    expect(updated.status).toBe('UNDER_REVIEW');
  });

  it('rejects an invalid status transition request', async () => {
    const { service, repository } = setup();
    repository.rows = [report({ id: 'a' })];
    await expect(
      service.updateStatus(admin, 'a', { status: 'NOT_A_STATUS' }),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('reports a missing report for an ADMIN update', async () => {
    const { service } = setup();
    await expect(
      service.updateStatus(admin, 'missing', { status: 'RESOLVED' }),
    ).rejects.toBeInstanceOf(ApiException);
  });
});
