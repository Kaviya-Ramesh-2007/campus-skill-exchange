import type {
  AuthenticatedIdentity,
  AuthorizationContext,
  SystemRole,
} from '@campus-skill-exchange/contracts';

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
export const SESSION_STORE = Symbol('SESSION_STORE');
export const AUTHORIZATION_POLICY = Symbol('AUTHORIZATION_POLICY');

export interface IdentityProviderAdapter {
  readonly providerName: string;
  verifyAccessToken(accessToken: string): Promise<AuthenticatedIdentity>;
}

export interface SessionStore {
  create(identity: AuthenticatedIdentity): Promise<string>;
  revoke(sessionId: string): Promise<void>;
  find(sessionId: string): Promise<AuthenticatedIdentity | null>;
}

export interface CurrentIdentityAccessor {
  get(): AuthenticatedIdentity | null;
}

export type AuthorizationAction =
  'read' | 'create' | 'update' | 'delete' | 'review' | 'moderate' | 'administer';

export interface ResourceAuthorizationContext {
  request: AuthorizationContext;
  action: AuthorizationAction;
  resourceType: string;
  resourceId?: string;
  ownerUserId?: string;
  participantUserIds?: string[];
}

export interface AuthorizationPolicy {
  can(context: ResourceAuthorizationContext): boolean;
  hasRole(identity: AuthenticatedIdentity | null, role: SystemRole): boolean;
}
