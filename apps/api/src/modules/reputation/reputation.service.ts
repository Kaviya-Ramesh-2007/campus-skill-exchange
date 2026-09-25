import { Inject, Injectable } from '@nestjs/common';
import {
  idSchema,
  type AuthenticatedIdentity,
  type AuthUser,
  type ReputationSummary,
} from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { AUTHORIZATION_POLICY, type AuthorizationPolicy } from '../../platform/auth/auth-contracts';
import { REPUTATION_REPOSITORY, type ReputationRepository } from './reputation.types';

@Injectable()
export class ReputationService {
  constructor(
    @Inject(REPUTATION_REPOSITORY) private readonly repository: ReputationRepository,
    @Inject(AUTHORIZATION_POLICY) private readonly authorizationPolicy: AuthorizationPolicy,
  ) {}

  async getSummary(actor: AuthUser, userId: string): Promise<ReputationSummary> {
    if (!idSchema.safeParse(userId).success) {
      throw new ApiException(400, 'VALIDATION_ERROR', 'userId must be a valid UUID.');
    }
    this.assertCanRead(actor, userId);
    if (!(await this.repository.userExists(userId))) {
      throw new ApiException(404, 'NOT_FOUND', 'The user was not found.');
    }
    return this.repository.getSummary(userId);
  }

  private assertCanRead(actor: AuthUser, userId: string): void {
    const identity: AuthenticatedIdentity = {
      userId: actor.id,
      issuer: 'local-session',
      subject: actor.id,
      roles: actor.roles,
      claims: {},
    };
    const allowed = this.authorizationPolicy.can({
      request: { identity },
      action: 'read',
      resourceType: 'Reputation',
      resourceId: userId,
      ownerUserId: userId,
    });
    if (allowed) return;
    throw new ApiException(403, 'AUTH_FORBIDDEN', 'You may only view your own reputation.');
  }
}
