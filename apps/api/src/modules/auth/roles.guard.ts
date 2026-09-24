import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SystemRole } from '@campus-skill-exchange/contracts';
import { ApiException } from '../../common/errors/api-exception';
import { ROLES_KEY, type AuthenticatedFastifyRequest } from './auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    const roles = request.auth?.user.roles ?? [];
    if (roles.some((role) => requiredRoles.includes(role))) return true;

    throw new ApiException(
      403,
      'AUTH_FORBIDDEN',
      'You do not have permission to perform this action.',
    );
  }
}
