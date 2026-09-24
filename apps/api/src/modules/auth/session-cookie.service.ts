import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class SessionCookieService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get cookieName(): string {
    return this.config.getOrThrow<string>('AUTH_SESSION_COOKIE_NAME');
  }

  getToken(request: FastifyRequest): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const value = cookies?.[this.cookieName];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  set(reply: FastifyReply, token: string, expiresAt: Date): void {
    const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    reply.setCookie(this.cookieName, token, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>('AUTH_SESSION_SAME_SITE'),
      path: '/',
      expires: expiresAt,
      maxAge,
    });
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>('AUTH_SESSION_SAME_SITE'),
      path: '/',
    });
  }

  private isProduction(): boolean {
    return this.config.getOrThrow<string>('NODE_ENV') === 'production';
  }
}
