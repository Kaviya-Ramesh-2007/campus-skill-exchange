import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service';
import { type ReputationRepository, type ReputationSummaryRecord } from './reputation.types';

@Injectable()
export class PrismaReputationRepository implements ReputationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async userExists(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    return user !== null;
  }

  async getSummary(userId: string): Promise<ReputationSummaryRecord> {
    const [completedSessions, ratings, assessments, badgeCount] = await Promise.all([
      this.prisma.learningSession.count({
        where: {
          status: 'COMPLETED',
          OR: [{ hostUserId: userId }, { participantUserId: userId }],
        },
      }),
      this.prisma.rating.aggregate({
        where: { ratedUserId: userId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.assessment.aggregate({
        where: { assessedUserId: userId },
        _avg: {
          understandingScore: true,
          practicalApplicationScore: true,
          problemSolvingScore: true,
          communicationScore: true,
          reliabilityScore: true,
        },
        _count: { _all: true },
      }),
      this.prisma.userBadge.count({ where: { userId } }),
    ]);

    return {
      userId,
      completedSessions,
      averageRating: ratings._avg.rating,
      ratingCount: ratings._count._all,
      assessmentCount: assessments._count._all,
      assessmentAverages: {
        understandingScore: assessments._avg.understandingScore,
        practicalApplicationScore: assessments._avg.practicalApplicationScore,
        problemSolvingScore: assessments._avg.problemSolvingScore,
        communicationScore: assessments._avg.communicationScore,
        reliabilityScore: assessments._avg.reliabilityScore,
      },
      badgeCount,
    };
  }
}
