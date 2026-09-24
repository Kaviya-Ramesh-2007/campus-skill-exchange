import { Injectable } from '@nestjs/common';
import type { AuthenticatedIdentity, SystemRole } from '@campus-skill-exchange/contracts';
import type {
  AuthorizationPolicy,
  ResourceAuthorizationContext,
} from '../../platform/auth/auth-contracts';

@Injectable()
export class SystemRoleAuthorizationPolicy implements AuthorizationPolicy {
  can(context: ResourceAuthorizationContext): boolean {
    const identity = context.request.identity;
    if (!identity) return false;

    if (
      context.action === 'administer' ||
      context.action === 'moderate' ||
      context.action === 'review'
    ) {
      return this.hasRole(identity, 'ADMIN');
    }

    if (context.action === 'delete' && !context.ownerUserId) {
      return this.hasRole(identity, 'ADMIN');
    }

    if (context.ownerUserId) {
      return identity.userId === context.ownerUserId || this.hasRole(identity, 'ADMIN');
    }

    if (context.participantUserIds?.includes(identity.userId)) {
      return true;
    }

    return this.hasRole(identity, 'ADMIN');
  }

  hasRole(identity: AuthenticatedIdentity | null, role: SystemRole): boolean {
    return identity?.roles.includes(role) ?? false;
  }
}
