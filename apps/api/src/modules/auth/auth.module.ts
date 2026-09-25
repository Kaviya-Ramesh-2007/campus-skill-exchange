import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { PrismaAuthRepository } from './prisma-auth.repository';
import { RolesGuard } from './roles.guard';
import { SystemRoleAuthorizationPolicy } from './authorization.policy';
import { SessionCookieService } from './session-cookie.service';
import { SessionService } from './session.service';
import { AUTH_REPOSITORY } from './auth.types';
import { AUTHORIZATION_POLICY, SESSION_STORE } from '../../platform/auth/auth-contracts';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    PasswordService,
    SessionCookieService,
    SessionService,
    AuthService,
    { provide: SESSION_STORE, useExisting: SessionService },
    { provide: AUTHORIZATION_POLICY, useClass: SystemRoleAuthorizationPolicy },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [
    AuthService,
    SessionService,
    SessionCookieService,
    AUTH_REPOSITORY,
    SESSION_STORE,
    AUTHORIZATION_POLICY,
  ],
})
export class AuthModule {}
