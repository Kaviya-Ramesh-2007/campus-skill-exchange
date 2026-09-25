import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../../platform/database/prisma.service';
import type { MatchData, MatchRepository, SkillReference, UserMatchData } from './matching.types';

type ContextUser = Prisma.UserGetPayload<{
  include: {
    profile: { select: { publicDisplayName: true } };
    userSkills: {
      where: { canTeach: true };
      include: { skill: { select: { id: true; name: true } } };
    };
    learningGoals: { include: { skill: { select: { id: true; name: true } } } };
  };
}>;

@Injectable()
export class PrismaMatchingRepository implements MatchRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async loadMatchData(requesterId: string): Promise<MatchData> {
    const include = {
      profile: { select: { publicDisplayName: true } },
      userSkills: {
        where: { canTeach: true },
        include: { skill: { select: { id: true, name: true } } },
        orderBy: { skill: { name: 'asc' } },
      },
      learningGoals: {
        include: { skill: { select: { id: true, name: true } } },
        orderBy: { skill: { name: 'asc' } },
      },
    } satisfies Prisma.UserInclude;
    const [requester, candidates] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: requesterId }, include }),
      this.prisma.user.findMany({
        where: {
          id: { not: requesterId },
          accountStatus: 'ACTIVE',
          profile: { is: { visibility: 'PUBLIC' } },
        },
        include,
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      }),
    ]);
    if (!requester) throw new Error('Authenticated user was not found.');
    return {
      requester: this.mapUser(requester),
      candidates: candidates.map((user) => this.mapUser(user)),
    };
  }

  private mapUser(user: ContextUser): UserMatchData {
    return {
      userId: user.id,
      displayName: user.profile?.publicDisplayName ?? user.displayName,
      teachableSkills: user.userSkills.map((userSkill) => this.skill(userSkill.skill)),
      learningGoals: user.learningGoals.map((goal) => ({
        id: goal.id,
        skill: this.skill(goal.skill),
      })),
    };
  }

  private skill(skill: { id: string; name: string }): SkillReference {
    return { id: skill.id, name: skill.name };
  }
}
