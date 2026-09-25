import { Inject, Injectable } from '@nestjs/common';
import { matchingQuerySchema, type MatchingUser } from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { MutualExchangeService } from './mutual-exchange.service';
import {
  MATCH_REPOSITORY,
  type MatchRepository,
  type SkillReference,
  type UserMatchData,
} from './matching.types';
import { compareText, eligibleCandidates } from './matching.utils';

@Injectable()
export class MatchingService {
  constructor(
    @Inject(MATCH_REPOSITORY) private readonly repository: MatchRepository,
    @Inject(MutualExchangeService) private readonly mutualExchangeService: MutualExchangeService,
  ) {}

  async findMatches(
    requesterId: string,
    query: unknown,
  ): Promise<{ items: MatchingUser[]; total: number; page: number; limit: number }> {
    const parsed = matchingQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    const data = await this.repository.loadMatchData(requesterId);
    const items = eligibleCandidates(requesterId, data.candidates)
      .map((candidate) => this.toMatch(data.requester, candidate))
      .filter((item): item is MatchingUser => item !== null)
      .sort(
        (a, b) =>
          b.matchScore - a.matchScore ||
          compareText(a.displayName, b.displayName) ||
          compareText(a.userId, b.userId),
      );
    const start = (parsed.data.page - 1) * parsed.data.limit;
    return {
      items: items.slice(start, start + parsed.data.limit),
      total: items.length,
      page: parsed.data.page,
      limit: parsed.data.limit,
    };
  }

  private toMatch(requester: UserMatchData, candidate: UserMatchData): MatchingUser | null {
    const theyTeachMyGoals = candidate.teachableSkills.filter((skill) =>
      requester.learningGoals.some((goal) => goal.skill.id === skill.id),
    );
    const iTeachTheirGoals = requester.teachableSkills.filter((skill) =>
      candidate.learningGoals.some((goal) => goal.skill.id === skill.id),
    );
    if (theyTeachMyGoals.length === 0 && iTeachTheirGoals.length === 0) return null;
    const exchangePairs = this.mutualExchangeService.findPairs(requester, candidate);
    const relevantSkills = uniqueSkills([...theyTeachMyGoals, ...iTeachTheirGoals]);
    const relevantLearningGoals = candidate.learningGoals.filter((goal) =>
      requester.teachableSkills.some((skill) => skill.id === goal.skill.id),
    );
    const reasons = [
      ...theyTeachMyGoals.map((skill) => `Can teach ${skill.name}, which you want to learn.`),
      ...iTeachTheirGoals.map((skill) => `You can teach ${skill.name}, which they want to learn.`),
      ...(exchangePairs.length ? ['Mutual skill exchange opportunity.'] : []),
    ];
    return {
      userId: candidate.userId,
      displayName: candidate.displayName,
      relevantSkills,
      relevantLearningGoals,
      matchScore:
        theyTeachMyGoals.length + iTeachTheirGoals.length + (exchangePairs.length > 0 ? 1 : 0),
      reasons,
      mutual: exchangePairs.length > 0,
    };
  }
}

function uniqueSkills(skills: SkillReference[]): SkillReference[] {
  const seen = new Set<string>();
  return skills.filter((skill) => {
    if (seen.has(skill.id)) return false;
    seen.add(skill.id);
    return true;
  });
}
