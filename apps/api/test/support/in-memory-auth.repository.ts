import type { AccountStatus, SystemRole } from '@campus-skill-exchange/contracts';
import {
  DuplicateEmailError,
  type AuthRepository,
  type AuthSessionRecord,
  type AuthUserRecord,
  type CreateLocalUserInput,
  type CreateSessionInput,
} from '../../src/modules/auth/auth.types';

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly sessions = new Map<string, AuthSessionRecord>();

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === email.toLowerCase(),
    );
    return user ? this.cloneUser(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = this.users.get(userId);
    return user ? this.cloneUser(user) : null;
  }

  async createUserWithLocalCredential(input: CreateLocalUserInput): Promise<AuthUserRecord> {
    if (await this.findUserByEmail(input.email)) throw new DuplicateEmailError();

    const now = new Date();
    const user: AuthUserRecord = {
      id: input.userId,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      passwordHash: input.passwordHash,
      roles: ['USER'],
    };
    this.users.set(user.id, user);
    return this.cloneUser(user);
  }

  async createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
    const user = this.users.get(input.userId);
    if (!user) throw new Error('Test user does not exist.');

    const session: AuthSessionRecord = {
      id: input.sessionId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      user: this.cloneUser(user),
    };
    this.sessions.set(session.id, session);
    return this.cloneSession(session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.tokenHash === tokenHash,
    );
    return session ? this.cloneSession(session) : null;
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) this.sessions.set(sessionId, { ...session, revokedAt });
  }

  setUserStatus(userId: string, status: AccountStatus): void {
    const user = this.users.get(userId);
    if (!user) return;

    const updatedUser = { ...user, status };
    this.users.set(userId, updatedUser);
    this.refreshSessionUsers(updatedUser);
  }

  grantRole(userId: string, role: SystemRole): void {
    const user = this.users.get(userId);
    if (!user || user.roles.includes(role)) return;

    const updatedUser = { ...user, roles: [...user.roles, role] };
    this.users.set(userId, updatedUser);
    this.refreshSessionUsers(updatedUser);
  }

  getPasswordHash(userId: string): string | null {
    return this.users.get(userId)?.passwordHash ?? null;
  }

  clear(): void {
    this.users.clear();
    this.sessions.clear();
  }

  private refreshSessionUsers(user: AuthUserRecord): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === user.id) {
        this.sessions.set(sessionId, { ...session, user: this.cloneUser(user) });
      }
    }
  }

  private cloneUser(user: AuthUserRecord): AuthUserRecord {
    return { ...user, roles: [...user.roles] };
  }

  private cloneSession(session: AuthSessionRecord): AuthSessionRecord {
    return { ...session, user: this.cloneUser(session.user) };
  }
}
