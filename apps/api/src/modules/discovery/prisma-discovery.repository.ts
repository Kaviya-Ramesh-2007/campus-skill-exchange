import { Inject, Injectable } from '@nestjs/common';
import type { DiscoveryUser } from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import type {
  DiscoveryRepository,
  DiscoverySearchInput,
  DiscoverySearchResult,
} from './discovery.types';

@Injectable()
export class PrismaDiscoveryRepository implements DiscoveryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async searchUsers(input: DiscoverySearchInput): Promise<DiscoverySearchResult> {
    const where = this.buildWhere(input);
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          profile: {
            select: {
              publicDisplayName: true,
              profileImageUrl: true,
              department: true,
              institution: true,
              bio: true,
            },
          },
          userSkills: {
            where: {
              canTeach: true,
              ...(input.skill ? { skill: { normalizedName: input.skill } } : {}),
            },
            include: { skill: { select: { id: true, name: true } } },
            orderBy: { skill: { name: 'asc' } },
          },
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: users.map((user) => this.mapUser(user)), total };
  }

  private buildWhere(input: DiscoverySearchInput): Prisma.UserWhereInput {
    const userSkillWhere: Prisma.UserSkillWhereInput = {
      canTeach: true,
      ...(input.skill ? { skill: { normalizedName: input.skill } } : {}),
    };
    const searchFilters: Prisma.UserWhereInput[] = input.search
      ? [
          { displayName: { contains: input.search, mode: 'insensitive' } },
          {
            profile: {
              is: {
                OR: [
                  { publicDisplayName: { contains: input.search, mode: 'insensitive' } },
                  { department: { contains: input.search, mode: 'insensitive' } },
                  { institution: { contains: input.search, mode: 'insensitive' } },
                  { bio: { contains: input.search, mode: 'insensitive' } },
                ],
              },
            },
          },
          {
            userSkills: {
              some: {
                canTeach: true,
                skill: { name: { contains: input.search, mode: 'insensitive' } },
              },
            },
          },
        ]
      : [];

    return {
      id: { not: input.requesterId },
      accountStatus: 'ACTIVE',
      profile: { is: { visibility: 'PUBLIC' } },
      userSkills: { some: userSkillWhere },
      ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
    };
  }

  private mapUser(user: {
    id: string;
    displayName: string;
    profile: {
      publicDisplayName: string | null;
      profileImageUrl: string | null;
      department: string | null;
      institution: string | null;
      bio: string | null;
    } | null;
    userSkills: Array<{
      proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
      description: string | null;
      skill: { id: string; name: string };
    }>;
  }): DiscoveryUser {
    return {
      userId: user.id,
      displayName: user.profile?.publicDisplayName ?? user.displayName,
      profileImageUrl: user.profile?.profileImageUrl ?? null,
      department: user.profile?.department ?? null,
      institution: user.profile?.institution ?? null,
      bio: user.profile?.bio ?? null,
      skills: user.userSkills.map((userSkill) => ({
        id: userSkill.skill.id,
        name: userSkill.skill.name,
        proficiency: userSkill.proficiency,
        description: userSkill.description,
      })),
    };
  }
}
