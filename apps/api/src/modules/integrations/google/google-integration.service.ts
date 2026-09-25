import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../platform/database/prisma.service';
import { ApiException } from '../../../common/errors/api-exception';
import {
  GOOGLE_API,
  type GoogleApi,
  type GoogleAuthorization,
  type GoogleEventData,
  type GoogleEventInput,
} from './google.types';

@Injectable()
export class GoogleIntegrationService {
  constructor(
    @Inject(GOOGLE_API) private readonly api: GoogleApi,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async getAuthorizationUrl(state: string): Promise<string> {
    this.assertConfigured();
    return this.api.createAuthorizationUrl(state);
  }

  async completeAuthorization(userId: string, code: string): Promise<void> {
    this.assertConfigured();
    const tokens = await this.api.exchangeCode(code);
    const existing = await this.prisma.googleConnection.findUnique({ where: { userId } });
    await this.prisma.googleConnection.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? existing?.refreshToken,
        accessTokenExpiresAt: tokens.expiresAt,
        scope: tokens.scope,
      },
    });
  }

  async status(
    userId: string,
  ): Promise<{ connected: boolean; scopes: string[]; expiresAt: string | null }> {
    const connection = await this.prisma.googleConnection.findUnique({ where: { userId } });
    if (!connection) return { connected: false, scopes: [], expiresAt: null };
    return {
      connected: true,
      scopes: connection.scope.split(/\s+/).filter(Boolean),
      expiresAt: connection.accessTokenExpiresAt?.toISOString() ?? null,
    };
  }

  async disconnect(userId: string): Promise<void> {
    const connection = await this.prisma.googleConnection.findUnique({ where: { userId } });
    if (!connection) return;
    try {
      await this.api.revokeAccessToken(connection.accessToken);
    } catch {
      // Revocation is best effort; the local authorization is still removed.
    }
    await this.prisma.googleConnection.delete({ where: { userId } });
  }

  async createEvent(userId: string, input: GoogleEventInput): Promise<GoogleEventData> {
    this.assertConfigured();
    const authorization = await this.authorizationFor(userId);
    return this.callGoogle(() => this.api.createEvent(authorization, input));
  }

  async updateEvent(
    userId: string,
    eventId: string,
    input: GoogleEventInput,
    existing: GoogleEventData | null,
  ): Promise<GoogleEventData> {
    this.assertConfigured();
    const authorization = await this.authorizationFor(userId);
    return this.callGoogle(() => this.api.updateEvent(authorization, eventId, input, existing));
  }

  async deleteEvent(userId: string, eventId: string | null): Promise<void> {
    if (!eventId) return;
    this.assertConfigured();
    const authorization = await this.authorizationFor(userId);
    await this.callGoogle(() => this.api.deleteEvent(authorization, eventId));
  }

  private async authorizationFor(userId: string): Promise<GoogleAuthorization> {
    const connection = await this.prisma.googleConnection.findUnique({ where: { userId } });
    if (!connection) {
      throw new ApiException(
        409,
        'CONFLICT',
        'Connect Google Calendar before using Google Meet for an online Session.',
      );
    }
    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.accessTokenExpiresAt,
    };
  }

  private async callGoogle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Google Calendar is temporarily unavailable.',
      );
    }
  }

  private assertConfigured(): void {
    if (
      !this.config.get<string>('GOOGLE_CLIENT_ID') ||
      !this.config.get<string>('GOOGLE_CLIENT_SECRET') ||
      !this.config.get<string>('GOOGLE_REDIRECT_URI')
    ) {
      throw new ApiException(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Google integration is not configured.',
      );
    }
  }
}
