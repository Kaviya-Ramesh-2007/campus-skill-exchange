import { describe, expect, it, vi } from 'vitest';
import { PrismaMatchingRepository } from '../src/modules/matching/prisma-matching.repository';
import type { PrismaService } from '../src/platform/database/prisma.service';

const requesterId = '00000000-0000-4000-8000-000000000001';
const candidateId = '00000000-0000-4000-8000-000000000002';
const skillId = '00000000-0000-4000-8000-000000000003';

const requester = {
  id: requesterId,
  displayName: 'Requester',
  profile: { publicDisplayName: 'Requester' },
  userSkills: [],
  learningGoals: [{ id: 'goal-1', skill: { id: skillId, name: 'AWS' } }],
};
const candidate = {
  id: candidateId,
  displayName: 'Candidate',
  profile: { publicDisplayName: 'Candidate' },
  userSkills: [{ skill: { id: skillId, name: 'AWS' } }],
  learningGoals: [],
};

describe('PrismaMatchingRepository', () => {
  it('queries only active public candidates and excludes the requester', async () => {
    const findUnique = vi.fn().mockResolvedValue(requester);
    const findMany = vi.fn().mockResolvedValue([candidate]);
    const prisma = {
      user: { findUnique, findMany },
    } as unknown as PrismaService;
    const repository = new PrismaMatchingRepository(prisma);

    const result = await repository.loadMatchData(requesterId);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { not: requesterId },
          accountStatus: 'ACTIVE',
          profile: { is: { visibility: 'PUBLIC' } },
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(result.requester.userId).toBe(requesterId);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.userId).toBe(candidateId);
  });
});
