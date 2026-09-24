import { describe, expect, it } from 'vitest';
import type { AuthenticatedIdentity, AuthorizationContext } from '@campus-skill-exchange/contracts';
import { SystemRoleAuthorizationPolicy } from '../src/modules/auth/authorization.policy';

function identity(roles: AuthenticatedIdentity['roles']): AuthenticatedIdentity {
  return {
    userId: '00000000-0000-4000-8000-000000000001',
    issuer: 'local',
    subject: 'test',
    roles,
    claims: {},
  };
}

function request(identityValue: AuthenticatedIdentity | null): AuthorizationContext {
  return { identity: identityValue };
}

describe('system role authorization policy', () => {
  const policy = new SystemRoleAuthorizationPolicy();

  it('allows an owner to access their own resource', () => {
    const currentUser = identity(['USER']);
    expect(
      policy.can({
        request: request(currentUser),
        action: 'update',
        resourceType: 'profile',
        resourceId: 'resource-1',
        ownerUserId: currentUser.userId,
      }),
    ).toBe(true);
  });

  it('reserves system review and moderation actions for ADMIN', () => {
    expect(
      policy.can({
        request: request(identity(['USER'])),
        action: 'review',
        resourceType: 'certification',
        resourceId: 'certification-1',
      }),
    ).toBe(false);
    expect(
      policy.can({
        request: request(identity(['ADMIN'])),
        action: 'moderate',
        resourceType: 'report',
        resourceId: 'report-1',
      }),
    ).toBe(true);
  });

  it('rejects unauthenticated authorization checks', () => {
    expect(
      policy.can({
        request: request(null),
        action: 'read',
        resourceType: 'profile',
        resourceId: 'resource-1',
      }),
    ).toBe(false);
    expect(policy.hasRole(null, 'ADMIN')).toBe(false);
  });
});
