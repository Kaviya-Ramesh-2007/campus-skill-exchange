import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaReportsRepository } from './prisma-reports.repository';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { REPORTS_REPOSITORY } from './reports.types';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [ReportsController],
  providers: [{ provide: REPORTS_REPOSITORY, useClass: PrismaReportsRepository }, ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
