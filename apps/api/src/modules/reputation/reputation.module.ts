import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ReputationController } from './reputation.controller';
import { ReputationService } from './reputation.service';
import { PrismaReputationRepository } from './prisma-reputation.repository';
import { REPUTATION_REPOSITORY } from './reputation.types';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ReputationController],
  providers: [
    { provide: REPUTATION_REPOSITORY, useClass: PrismaReputationRepository },
    ReputationService,
  ],
  exports: [ReputationService],
})
export class ReputationModule {}
