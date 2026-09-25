import { describe, expect, it } from 'vitest';
import { MatchingService } from '../src/modules/matching/matching.service';
import { MutualExchangeService } from '../src/modules/matching/mutual-exchange.service';
import type { MatchData, MatchRepository } from '../src/modules/matching/matching.types';

const requesterId = '00000000-0000-4000-8000-000000000001';
const candidateId = '00000000-0000-4000-8000-000000000002';
const cpp = { id: '00000000-0000-4000-8000-000000000003', name: 'C++' };
const aws = { id: '00000000-0000-4000-8000-000000000004', name: 'AWS' };

function serviceFor(data: MatchData) {
  const repository = { loadMatchData: async () => data } as unknown as MatchRepository;
  const exchanges = new MutualExchangeService(repository);
  return { service: new MatchingService(repository, exchanges), exchanges };
}

describe('matching and mutual exchange services', () => {
  it('matches a learning goal to a teachable skill and detects mutual exchange', async () => {
    const data: MatchData = {
      requester: {
        userId: requesterId,
        displayName: 'Requester',
        teachableSkills: [cpp],
        learningGoals: [{ id: 'goal-1', skill: aws }],
      },
      candidates: [
        {
          userId: candidateId,
          displayName: 'Candidate',
          teachableSkills: [aws],
          learningGoals: [{ id: 'goal-2', skill: cpp }],
        },
      ],
    };
    const { service, exchanges } = serviceFor(data);

    const matches = await service.findMatches(requesterId, {});
    const mutual = await exchanges.listMutualExchanges(requesterId, {});

    expect(matches.items[0]!).toMatchObject({ userId: candidateId, mutual: true, matchScore: 3 });
    expect(matches.items[0]!.reasons).toContain('Mutual skill exchange opportunity.');
    expect(mutual.items[0]).toMatchObject({
      partnerUserId: candidateId,
      explanation: 'Both users can teach a skill the other wants to learn.',
    });
    expect(mutual.items[0]!.exchangePairs).toEqual([
      { skillYouCanTeach: cpp, skillTheyCanTeach: aws },
    ]);
  });

  it('returns a one-way match without claiming a mutual exchange', async () => {
    const data: MatchData = {
      requester: {
        userId: requesterId,
        displayName: 'Requester',
        teachableSkills: [],
        learningGoals: [{ id: 'goal-1', skill: aws }],
      },
      candidates: [
        {
          userId: candidateId,
          displayName: 'Candidate',
          teachableSkills: [aws],
          learningGoals: [],
        },
      ],
    };
    const { service, exchanges } = serviceFor(data);

    const matches = await service.findMatches(requesterId, {});
    expect(matches.items[0]!).toMatchObject({ mutual: false, matchScore: 1 });
    expect(matches.items[0]!.reasons).toEqual(['Can teach AWS, which you want to learn.']);
    expect((await exchanges.listMutualExchanges(requesterId, {})).items).toEqual([]);
  });

  it('excludes the requester and deduplicates candidate users', async () => {
    const candidate = {
      userId: candidateId,
      displayName: 'Candidate',
      teachableSkills: [aws],
      learningGoals: [],
    };
    const data: MatchData = {
      requester: {
        userId: requesterId,
        displayName: 'Requester',
        teachableSkills: [],
        learningGoals: [{ id: 'goal-1', skill: aws }],
      },
      candidates: [
        { ...candidate, userId: requesterId, displayName: 'Requester' },
        candidate,
        { ...candidate },
      ],
    };
    const { service, exchanges } = serviceFor(data);

    expect((await service.findMatches(requesterId, {})).items).toHaveLength(1);
    expect((await exchanges.listMutualExchanges(requesterId, {})).items).toEqual([]);
  });

  it('orders equal matches deterministically and paginates after scoring', async () => {
    const data: MatchData = {
      requester: {
        userId: requesterId,
        displayName: 'Requester',
        teachableSkills: [],
        learningGoals: [{ id: 'goal-1', skill: aws }],
      },
      candidates: [
        {
          userId: '00000000-0000-4000-8000-000000000009',
          displayName: 'Zoe',
          teachableSkills: [aws],
          learningGoals: [],
        },
        {
          userId: '00000000-0000-4000-8000-000000000008',
          displayName: 'Amy',
          teachableSkills: [aws],
          learningGoals: [],
        },
      ],
    };
    const { service } = serviceFor(data);
    const result = await service.findMatches(requesterId, { page: 1, limit: 1 });
    expect(result.total).toBe(2);
    expect(result.items[0]!.displayName).toBe('Amy');
  });
});
