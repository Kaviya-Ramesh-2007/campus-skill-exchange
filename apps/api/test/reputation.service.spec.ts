import { describe, expect, it } from 'vitest';
import { ApiException } from '../src/common/errors/api-exception';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';
import { ReputationService } from '../src/modules/reputation/reputation.service';
import type {
  ReputationRepository,
  ReputationSummaryRecord,
} from '../src/modules/reputation/reputation.types';
import type { AuthUser } from '@campus-skill-exchange/contracts';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const now = new Date('2026-10-01T12:00:00.000Z');
const actor: AuthUser = {
  id: userId,
  email: 'user@example.test',
  displayName: 'User',
  status: 'ACTIVE',
  roles: ['USER'],
  createdAt: now.toISOString(),
};
const admin: AuthUser = { ...actor, roles: ['USER', 'ADMIN'] };
const summary: ReputationSummaryRecord = {
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
};

class FakeReputationRepository implements ReputationRepository {
  exists = true;
  async userExists(id: string) {
    return this.exists && id === userId;
  }
  async getSummary() {
    return summary;
  }
}

describe('ReputationService', () => {
  it('returns transparent aggregates for the owner or an ADMIN', async () => {
    const repository = new FakeReputationRepository();
    const service = new ReputationService(repository, new SystemRoleAuthorizationPolicy());

    await expect(service.getSummary(actor, userId)).resolves.toEqual(summary);
    await expect(service.getSummary(admin, userId)).resolves.toEqual(summary);
    await expect(service.getSummary({ ...actor, id: otherId }, userId)).rejects.toBeInstanceOf(
      ApiException,
    );
  });

  it('rejects missing users and malformed identifiers', async () => {
    const repository = new FakeReputationRepository();
    repository.exists = false;
    const service = new ReputationService(repository, new SystemRoleAuthorizationPolicy());

    await expect(service.getSummary(actor, userId)).rejects.toBeInstanceOf(ApiException);
    await expect(service.getSummary(actor, 'not-a-uuid')).rejects.toBeInstanceOf(ApiException);
  });
});
