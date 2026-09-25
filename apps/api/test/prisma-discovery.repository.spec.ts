import { describe, expect, it, vi } from 'vitest';
import { PrismaDiscoveryRepository } from '../src/modules/discovery/prisma-discovery.repository';
import type { PrismaService } from '../src/platform/database/prisma.service';

const requesterId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const skillId = '00000000-0000-4000-8000-000000000003';
const secondSkillId = '00000000-0000-4000-8000-000000000004';

const user = {
  id: userId,
  displayName: 'Grace Hopper',
  profile: {
    publicDisplayName: 'Grace',
    profileImageUrl: null,
    department: 'Computer Science',
    institution: 'Example University',
    bio: 'Builds useful things.',
  },
  userSkills: [
    { proficiency: 'EXPERT', description: 'Can help', skill: { id: skillId, name: 'Java' } },
    {
      proficiency: 'ADVANCED',
      description: null,
      skill: { id: secondSkillId, name: 'JavaScript' },
    },
  ],
};

describe('PrismaDiscoveryRepository', () => {
  it('filters by public profile, normalized skill, canTeach, requester, and pagination', async () => {
    const findMany = vi.fn().mockResolvedValue([user]);
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      user: { findMany, count },
      $transaction: vi.fn().mockResolvedValue([[user], 1]),
    } as unknown as PrismaService;
    const repository = new PrismaDiscoveryRepository(prisma);

    const result = await repository.searchUsers({
      requesterId,
      skill: 'java',
      search: 'grace',
      page: 2,
      limit: 10,
    });

    const call = findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    const where = call.where;
    expect(where).toMatchObject({
      id: { not: requesterId },
      accountStatus: 'ACTIVE',
      profile: { is: { visibility: 'PUBLIC' } },
      userSkills: { some: { canTeach: true, skill: { normalizedName: 'java' } } },
    });
    expect(where.OR ?? []).toHaveLength(3);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      userId,
      displayName: 'Grace',
      skills: [
        { id: skillId, name: 'Java' },
        { id: secondSkillId, name: 'JavaScript' },
      ],
    });
  });
});
