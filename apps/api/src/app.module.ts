import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { validateEnvironment } from './config/env';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { AppLogger } from './platform/logging/app-logger';
import { DatabaseModule } from './platform/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [AppLogger, { provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
