import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service';
import type { Prisma } from '@campus-skill-exchange/database';
import {
  DuplicateEmailError,
  type AuthRepository,
  type AuthSessionRecord,
  type AuthUserRecord,
  type CreateLocalUserInput,
  type CreateSessionInput,
} from './auth.types';

type UserWithCredential = Prisma.UserGetPayload<{
  include: { roles: true; passwordCredential: true };
}>;

type UserWithRoles = Prisma.UserGetPayload<{
  include: { roles: true };
}>;

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: true, passwordCredential: true },
    });
    return user ? this.mapUserWithCredential(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, passwordCredential: true },
    });
    return user ? this.mapUserWithCredential(user) : null;
  }

  async createUserWithLocalCredential(input: CreateLocalUserInput): Promise<AuthUserRecord> {
    try {
      const user = await this.prisma.$transaction(async (tx) =>
        tx.user.create({
          data: {
            id: input.userId,
            email: input.email,
            displayName: input.displayName,
            roles: { create: { role: 'USER' } },
            identities: {
              create: {
                id: input.identityId,
                provider: 'LOCAL',
                providerSubject: input.userId,
              },
            },
            passwordCredential: {
              create: {
                id: input.credentialId,
                passwordHash: input.passwordHash,
              },
            },
          },
          include: { roles: true, passwordCredential: true },
        }),
      );
      return this.mapUserWithCredential(user);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) throw new DuplicateEmailError();
      throw error;
    }
  }

  async createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
    const session = await this.prisma.session.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      include: { user: { include: { roles: true } } },
    });
    return {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt,
      user: this.mapUserWithRoles(session.user),
    };
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { roles: true } } },
    });
    if (!session) return null;

    return {
      id: session.id,
      userId: session.userId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      createdAt: session.createdAt,
      user: this.mapUserWithRoles(session.user),
    };
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt },
    });
  }

  private mapUserWithCredential(user: UserWithCredential): AuthUserRecord {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.accountStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordHash: user.passwordCredential?.passwordHash ?? null,
      roles: user.roles.map((role) => role.role),
    };
  }

  private mapUserWithRoles(user: UserWithRoles): AuthUserRecord {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.accountStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordHash: null,
      roles: user.roles.map((role) => role.role),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
