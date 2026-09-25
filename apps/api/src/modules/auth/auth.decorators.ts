import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { SystemRole } from '@campus-skill-exchange/contracts';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedContext } from './session.service';

export const IS_PUBLIC_KEY = 'auth:is-public';
export const ROLES_KEY = 'auth:roles';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedFastifyRequest extends FastifyRequest {
  auth?: AuthenticatedContext;
}

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
  return request.auth?.user;
});

export const CurrentSessionId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
  return request.auth?.sessionId;
});
