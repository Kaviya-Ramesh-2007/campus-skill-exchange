import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaRequestsRepository } from './prisma-requests.repository';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { REQUESTS_REPOSITORY } from './requests.types';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [RequestsController],
  providers: [
    { provide: REQUESTS_REPOSITORY, useClass: PrismaRequestsRepository },
    RequestsService,
  ],
  exports: [RequestsService],
})
export class RequestsModule {}
