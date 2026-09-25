import { describe, expect, it, vi } from 'vitest';
import { GrowthService } from '../src/modules/growth/growth.service';
import type { GrowthRepository, LearningGoalRecord } from '../src/modules/growth/growth.types';

const userId = '00000000-0000-4000-8000-000000000001';
const skillId = '00000000-0000-4000-8000-000000000002';
const goal: LearningGoalRecord = {
  id: '00000000-0000-4000-8000-000000000003',
  userId,
  skillId,
  skillName: 'JavaScript',
  currentLevel: 'BEGINNER',
  targetLevel: 'ADVANCED',
  description: null,
  priority: 'MEDIUM',
  createdAt: new Date('2026-09-24T00:00:00.000Z'),
  updatedAt: new Date('2026-09-24T00:00:00.000Z'),
};

describe('GrowthService', () => {
  it('creates a learning goal for the authenticated user', async () => {
    const repository = {
      createLearningGoal: vi.fn().mockResolvedValue(goal),
    } as unknown as GrowthRepository;
    const service = new GrowthService(repository);

    const result = await service.createLearningGoal(userId, {
      skillId,
      targetLevel: 'ADVANCED',
    });

    expect(repository.createLearningGoal).toHaveBeenCalledWith(userId, {
      skillId,
      currentLevel: 'BEGINNER',
      targetLevel: 'ADVANCED',
      priority: 'MEDIUM',
    });
    expect(result).toMatchObject({ id: goal.id, skillName: 'JavaScript' });
  });

  it('rejects invalid availability before repository access', async () => {
    const repository = {
      createAvailability: vi.fn(),
    } as unknown as GrowthRepository;
    const service = new GrowthService(repository);

    expect(() =>
      service.createAvailability(userId, {
        dayOfWeek: 'MONDAY',
        startTime: '18:00',
        endTime: '17:00',
      }),
    ).toThrow();
    expect(repository.createAvailability).not.toHaveBeenCalled();
  });
});
