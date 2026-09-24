import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ApiException } from '../../common/errors/api-exception';
import type { AuthenticatedIdentity } from '@campus-skill-exchange/contracts';
import type { SessionStore } from '../../platform/auth/auth-contracts';
import { toAuthUser } from './auth.mapper';
import { AUTH_REPOSITORY, type AuthRepository } from './auth.types';

export interface AuthenticatedContext {
  sessionId: string;
  user: ReturnType<typeof toAuthUser>;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService implements SessionStore {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async createForUser(userId: string): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + this.config.getOrThrow<number>('AUTH_SESSION_TTL_SECONDS') * 1000,
    );

    await this.repository.createSession({
      sessionId: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
    });

    return { token, expiresAt };
  }

  async create(identity: AuthenticatedIdentity): Promise<string> {
    const session = await this.createForUser(identity.userId);
    return session.token;
  }

  async authenticate(token: string): Promise<AuthenticatedContext> {
    const session = await this.repository.findSessionByTokenHash(this.hashToken(token));
    if (!session || session.revokedAt) {
      throw new ApiException(401, 'AUTH_SESSION_REQUIRED', 'A valid session is required.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new ApiException(401, 'AUTH_SESSION_EXPIRED', 'Your session has expired.');
    }

    if (session.user.status === 'SUSPENDED') {
      throw new ApiException(403, 'AUTH_ACCOUNT_SUSPENDED', 'This account is suspended.');
    }

    return {
      sessionId: session.id,
      user: toAuthUser(session.user),
    };
  }

  async find(sessionToken: string): Promise<AuthenticatedIdentity | null> {
    try {
      const context = await this.authenticate(sessionToken);
      return {
        userId: context.user.id,
        issuer: 'local',
        subject: context.sessionId,
        roles: context.user.roles,
        claims: {},
      };
    } catch (error) {
      if (error instanceof ApiException) return null;
      throw error;
    }
  }

  async revoke(sessionId: string): Promise<void> {
    await this.repository.revokeSession(sessionId, new Date());
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
