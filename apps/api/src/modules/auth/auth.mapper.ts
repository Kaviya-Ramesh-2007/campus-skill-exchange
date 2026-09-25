import type { AuthUser } from '@campus-skill-exchange/contracts';
import type { AuthUserRecord } from './auth.types';

export function toAuthUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    roles: [...user.roles],
    createdAt: user.createdAt.toISOString(),
  };
}
