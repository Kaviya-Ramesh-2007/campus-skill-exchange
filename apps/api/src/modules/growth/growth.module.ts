import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../auth/auth.module';
import {
  AvailabilityController,
  CertificationsController,
  LearningGoalsController,
  ProjectsController,
} from './growth.controller';
import { GrowthService } from './growth.service';
import { PrismaGrowthRepository } from './prisma-growth.repository';
import { GROWTH_REPOSITORY } from './growth.types';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    LearningGoalsController,
    AvailabilityController,
    CertificationsController,
    ProjectsController,
  ],
  providers: [{ provide: GROWTH_REPOSITORY, useClass: PrismaGrowthRepository }, GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
