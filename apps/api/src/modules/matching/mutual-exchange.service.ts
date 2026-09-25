import { Inject, Injectable } from '@nestjs/common';
import { matchingQuerySchema, type MutualExchange } from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import {
  MATCH_REPOSITORY,
  type MatchRepository,
  type SkillReference,
  type UserMatchData,
} from './matching.types';
import { compareText, eligibleCandidates } from './matching.utils';

@Injectable()
export class MutualExchangeService {
  constructor(@Inject(MATCH_REPOSITORY) private readonly repository: MatchRepository) {}

  findPairs(requester: UserMatchData, candidate: UserMatchData): ExchangePair[] {
    const requesterOffers = requester.teachableSkills.filter((skill) =>
      candidate.learningGoals.some((goal) => goal.skill.id === skill.id),
    );
    const candidateOffers = candidate.teachableSkills.filter((skill) =>
      requester.learningGoals.some((goal) => goal.skill.id === skill.id),
    );
    if (requesterOffers.length === 0 || candidateOffers.length === 0) return [];

    const pairs: ExchangePair[] = [];
    for (const requesterSkill of requesterOffers) {
      const candidateGoal = candidate.learningGoals.find(
        (goal) => goal.skill.id === requesterSkill.id,
      );
      if (!candidateGoal) continue;
      for (const candidateSkill of candidateOffers) {
        const requesterGoal = requester.learningGoals.find(
          (goal) => goal.skill.id === candidateSkill.id,
        );
        if (!requesterGoal) continue;
        pairs.push({
          skillYouCanTeach: requesterSkill,
          skillTheyCanTeach: candidateSkill,
        });
      }
    }
    return pairs;
  }

  async listMutualExchanges(
    requesterId: string,
    query: unknown,
  ): Promise<{ items: MutualExchange[]; total: number; page: number; limit: number }> {
    const parsed = matchingQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new ApiException(400, 'VALIDATION_ERROR', 'Request validation failed.');
    const data = await this.repository.loadMatchData(requesterId);
    const items = eligibleCandidates(requesterId, data.candidates)
      .map((candidate) => {
        const exchangePairs = this.findPairs(data.requester, candidate);
        return exchangePairs.length
          ? {
              partnerUserId: candidate.userId,
              displayName: candidate.displayName,
              exchangePairs,
              explanation: 'Both users can teach a skill the other wants to learn.',
            }
          : null;
      })
      .filter((item): item is MutualExchange => item !== null)
      .sort(
        (a, b) =>
          compareText(a.displayName, b.displayName) ||
          compareText(a.partnerUserId, b.partnerUserId),
      );
    const start = (parsed.data.page - 1) * parsed.data.limit;
    return {
      items: items.slice(start, start + parsed.data.limit),
      total: items.length,
      page: parsed.data.page,
      limit: parsed.data.limit,
    };
  }
}

export interface ExchangePair {
  skillYouCanTeach: SkillReference;
  skillTheyCanTeach: SkillReference;
}
