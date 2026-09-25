import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../common/errors/api-exception';
import { parseCorsOrigins } from '../../config/env';
import { IS_PUBLIC_KEY, type AuthenticatedFastifyRequest } from './auth.decorators';
import { SessionCookieService } from './session-cookie.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionCookieService) private readonly sessionCookie: SessionCookieService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    this.assertAllowedOrigin(request);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const token = this.sessionCookie.getToken(request);
    if (!token) {
      throw new ApiException(401, 'AUTH_SESSION_REQUIRED', 'A valid session is required.');
    }

    request.auth = await this.sessionService.authenticate(token);
    return true;
  }

  private assertAllowedOrigin(request: AuthenticatedFastifyRequest): void {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

    const origin = request.headers.origin;
    if (!origin) return;

    const allowedOrigins = parseCorsOrigins(this.config.getOrThrow<string>('CORS_ORIGINS'));
    if (typeof origin !== 'string' || !allowedOrigins.includes(origin)) {
      throw new ApiException(403, 'AUTH_FORBIDDEN', 'The request origin is not allowed.');
    }
  }
}
