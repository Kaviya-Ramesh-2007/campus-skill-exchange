import { describe, expect, it, vi } from 'vitest';
import { PrismaReputationRepository } from '../src/modules/reputation/prisma-reputation.repository';
import type { PrismaService } from '../src/platform/database/prisma.service';

const userId = '00000000-0000-4000-8000-000000000001';

describe('PrismaReputationRepository', () => {
  it('aggregates only completed sessions, received ratings/assessments, and badges', async () => {
    const learningSessionCount = vi.fn().mockResolvedValue(4);
    const ratingAggregate = vi.fn().mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { _all: 2 },
    });
    const assessmentAggregate = vi.fn().mockResolvedValue({
      _avg: {
        understandingScore: 5,
        practicalApplicationScore: 4,
        problemSolvingScore: 4,
        communicationScore: 5,
        reliabilityScore: 5,
      },
      _count: { _all: 1 },
    });
    const badgeCount = vi.fn().mockResolvedValue(3);
    const prisma = {
      learningSession: { count: learningSessionCount },
      rating: { aggregate: ratingAggregate },
      assessment: { aggregate: assessmentAggregate },
      userBadge: { count: badgeCount },
    } as unknown as PrismaService;
    const repository = new PrismaReputationRepository(prisma);

    await expect(repository.getSummary(userId)).resolves.toEqual({
      userId,
      completedSessions: 4,
      averageRating: 4.5,
      ratingCount: 2,
      assessmentCount: 1,
      assessmentAverages: {
        understandingScore: 5,
        practicalApplicationScore: 4,
        problemSolvingScore: 4,
        communicationScore: 5,
        reliabilityScore: 5,
      },
      badgeCount: 3,
    });
    expect(learningSessionCount).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        OR: [{ hostUserId: userId }, { participantUserId: userId }],
      },
    });
    expect(ratingAggregate).toHaveBeenCalledWith({
      where: { ratedUserId: userId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    expect(badgeCount).toHaveBeenCalledWith({ where: { userId } });
  });
});
