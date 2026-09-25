import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { PrismaAssessmentsRepository } from './prisma-assessments.repository';
import { ASSESSMENTS_REPOSITORY } from './assessments.types';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [AssessmentsController],
  providers: [
    { provide: ASSESSMENTS_REPOSITORY, useClass: PrismaAssessmentsRepository },
    AssessmentsService,
  ],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
