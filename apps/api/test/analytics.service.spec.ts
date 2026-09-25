import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type { AuthUser } from '@campus-skill-exchange/contracts';

const now = '2026-10-01T12:00:00.000Z';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.test',
  displayName: 'Arun',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: now,
} as unknown as AuthUser;
const admin = { ...user, roles: ['USER', 'ADMIN'] } as unknown as AuthUser;

const COUNTS = {
  totalUsers: 12,
  activeUsers: 10,
  totalSkills: 34,
  totalSessions: 7,
  completedSessions: 3,
  paidSessions: 2,
  totalReports: 4,
  openReports: 1,
};

function setup() {
  const count = vi.fn();
  const prisma = {
    user: { count },
    skill: { count },
    learningSession: { count },
    report: { count },
    $transaction: vi.fn(async (queries: unknown[]) => Promise.all(queries)),
  } as unknown as PrismaService;

  // Each COUNT in the transaction resolves in order to its own value.
  const queue = [
    COUNTS.totalUsers,
    COUNTS.activeUsers,
    COUNTS.totalSkills,
    COUNTS.totalSessions,
    COUNTS.completedSessions,
    COUNTS.paidSessions,
    COUNTS.totalReports,
    COUNTS.openReports,
  ];
  count.mockImplementation(() => Promise.resolve(queue.shift() ?? 0));

  const service = new AnalyticsService(prisma, new SystemRoleAuthorizationPolicy());
  return { service, prisma, count };
}

describe('AnalyticsService', () => {
  it('returns the real aggregate counters for an ADMIN', async () => {
    const { service } = setup();
    await expect(service.overview(admin)).resolves.toEqual(COUNTS);
  });

  it('refuses a normal USER and issues no aggregate queries', async () => {
    const { service, count } = setup();
    await expect(service.overview(user)).rejects.toBeInstanceOf(ApiException);
    expect(count).not.toHaveBeenCalled();
  });

  it('exposes exactly the eight agreed metrics', async () => {
    const { service } = setup();
    const result = await service.overview(admin);
    expect(Object.keys(result).sort()).toEqual([
      'activeUsers',
      'completedSessions',
      'openReports',
      'paidSessions',
      'totalReports',
      'totalSessions',
      'totalSkills',
      'totalUsers',
    ]);
  });

  it('returns zeros rather than inventing values on an empty platform', async () => {
    const prisma = {
      user: { count: vi.fn().mockResolvedValue(0) },
      skill: { count: vi.fn().mockResolvedValue(0) },
      learningSession: { count: vi.fn().mockResolvedValue(0) },
      report: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(async (queries: unknown[]) => Promise.all(queries)),
    } as unknown as PrismaService;
    const service = new AnalyticsService(prisma, new SystemRoleAuthorizationPolicy());

    const result = await service.overview(admin);
    expect(Object.values(result).every((value) => value === 0)).toBe(true);
  });

  it('uses one transactional round trip for all counters', async () => {
    const { service, prisma } = setup();
    await service.overview(admin);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
