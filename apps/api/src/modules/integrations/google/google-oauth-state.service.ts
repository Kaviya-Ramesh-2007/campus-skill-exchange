import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiException } from '../../../common/errors/api-exception';

@Injectable()
export class GoogleOAuthStateService {
  private readonly cookieName = 'cse_google_oauth_state';

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  issue(reply: FastifyReply): string {
    const state = randomBytes(32).toString('hex');
    reply.setCookie(this.cookieName, state, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/integrations/google',
      maxAge: 600,
    });
    return state;
  }

  assertValid(state: string | undefined, request: FastifyRequest): void {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const expected = cookies?.[this.cookieName];
    if (typeof state !== 'string' || typeof expected !== 'string' || state !== expected) {
      throw new ApiException(400, 'BAD_REQUEST', 'Google OAuth state validation failed.');
    }
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/integrations/google',
    });
  }
}
