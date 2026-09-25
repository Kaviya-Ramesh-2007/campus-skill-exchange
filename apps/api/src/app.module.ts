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
import { GrowthModule } from './modules/growth/growth.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { MatchingModule } from './modules/matching/matching.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { GoogleIntegrationModule } from './modules/integrations/google/google-integration.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { BadgesModule } from './modules/badges/badges.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { ReputationModule } from './modules/reputation/reputation.module';
import { PaymentsModule } from './modules/payments/payments.module';

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
    GrowthModule,
    DiscoveryModule,
    MatchingModule,
    RequestsModule,
    SessionsModule,
    GoogleIntegrationModule,
    RatingsModule,
    BadgesModule,
    AssessmentsModule,
    ReputationModule,
    PaymentsModule,
  ],
  providers: [AppLogger, { provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
