import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../platform/database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { GoogleApiClient } from './google-api';
import { GoogleIntegrationController } from './google-integration.controller';
import { GoogleIntegrationService } from './google-integration.service';
import { GoogleOAuthStateService } from './google-oauth-state.service';
import { GOOGLE_API } from './google.types';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [GoogleIntegrationController],
  providers: [
    { provide: GOOGLE_API, useClass: GoogleApiClient },
    GoogleIntegrationService,
    GoogleOAuthStateService,
  ],
  exports: [GoogleIntegrationService],
})
export class GoogleIntegrationModule {}
