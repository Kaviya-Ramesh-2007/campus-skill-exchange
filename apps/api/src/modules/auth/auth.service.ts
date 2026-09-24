import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { toAuthUser } from './auth.mapper';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import {
  AUTH_REPOSITORY,
  DuplicateEmailError,
  type AuthRepository,
  type AuthUserRecord,
} from './auth.types';

export interface AuthResult {
  response: AuthResponse;
  sessionToken: string;
  sessionExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(SessionService) private readonly sessionService: SessionService,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResult> {
    const email = normalizeEmail(input.email);
    const displayName = normalizeDisplayName(input.displayName);
    const existing = await this.repository.findUserByEmail(email);
    if (existing) {
      throw new ApiException(
        409,
        'AUTH_EMAIL_ALREADY_EXISTS',
        'An account with this email already exists.',
      );
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const userId = randomUUID();

    let user: AuthUserRecord;
    try {
      user = await this.repository.createUserWithLocalCredential({
        userId,
        identityId: randomUUID(),
        credentialId: randomUUID(),
        email,
        displayName,
        passwordHash,
      });
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ApiException(
          409,
          'AUTH_EMAIL_ALREADY_EXISTS',
          'An account with this email already exists.',
        );
      }
      throw error;
    }

    const session = await this.sessionService.createForUser(user.id);
    return this.toResult(user, session);
  }

  async login(input: LoginRequest): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(normalizeEmail(input.email));
    const passwordValid = await this.passwordService.verifyOrDummy(
      input.password,
      user?.passwordHash ?? null,
    );

    if (!user || !passwordValid) {
      throw new ApiException(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (user.status === 'SUSPENDED') {
      throw new ApiException(403, 'AUTH_ACCOUNT_SUSPENDED', 'This account is suspended.');
    }

    const session = await this.sessionService.createForUser(user.id);
    return this.toResult(user, session);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.revoke(sessionId);
  }

  async getSafeUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new ApiException(401, 'AUTH_SESSION_REQUIRED', 'A valid session is required.');
    }
    return toAuthUser(user);
  }

  private toResult(user: AuthUserRecord, session: { token: string; expiresAt: Date }): AuthResult {
    return {
      response: {
        user: toAuthUser(user),
        session: { expiresAt: session.expiresAt.toISOString() },
      },
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt,
    };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, ' ');
}
