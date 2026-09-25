import type { AccountStatus, SystemRole } from '@campus-skill-exchange/contracts';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface AuthUserRecord {
  id: string;
  email: string;
  displayName: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  passwordHash: string | null;
  roles: SystemRole[];
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  user: AuthUserRecord;
}

export interface CreateLocalUserInput {
  userId: string;
  identityId: string;
  credentialId: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

export interface CreateSessionInput {
  sessionId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  createUserWithLocalCredential(input: CreateLocalUserInput): Promise<AuthUserRecord>;
  createSession(input: CreateSessionInput): Promise<AuthSessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('A user with this normalized email already exists.');
    this.name = 'DuplicateEmailError';
  }
}
