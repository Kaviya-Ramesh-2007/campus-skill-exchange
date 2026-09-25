import { Inject, Injectable } from '@nestjs/common';
import type { AnalyticsOverview, AuthUser } from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AUTHORIZATION_POLICY, type AuthorizationPolicy } from '../../platform/auth/auth-contracts';
import { PrismaService } from '../../platform/database/prisma.service';

/**
 * Read-only platform counters. Every value is a real PostgreSQL aggregate over
 * existing tables: there is no analytics store, no cache and no fallback figure,
 * and no user-level or personal data is ever returned.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUTHORIZATION_POLICY) private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async overview(actor: AuthUser): Promise<AnalyticsOverview> {
    if (!this.isAdmin(actor)) {
      throw new ApiException(403, 'AUTH_FORBIDDEN', 'Only an ADMIN can view platform analytics.');
    }
    // One round trip; each entry is a separate COUNT so Postgres can use its
    // cheapest index for that predicate.
    const [
      totalUsers,
      activeUsers,
      totalSkills,
      totalSessions,
      completedSessions,
      paidSessions,
      totalReports,
      openReports,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { accountStatus: 'ACTIVE' } }),
      this.prisma.skill.count(),
      this.prisma.learningSession.count(),
      this.prisma.learningSession.count({ where: { status: 'COMPLETED' } }),
      this.prisma.learningSession.count({ where: { paymentMode: 'PAID' } }),
      this.prisma.report.count(),
      this.prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalSkills,
      totalSessions,
      completedSessions,
      paidSessions,
      totalReports,
      openReports,
    };
  }

  private isAdmin(actor: AuthUser): boolean {
    return this.authorizationPolicy.can({
      request: {
        identity: {
          userId: actor.id,
          issuer: 'campus-skill-exchange',
          subject: actor.id,
          roles: actor.roles,
          claims: {},
        },
      },
      action: 'moderate',
      resourceType: 'Analytics',
    });
  }
}
