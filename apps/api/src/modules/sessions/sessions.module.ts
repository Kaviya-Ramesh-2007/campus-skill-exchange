import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaSessionsRepository } from './prisma-sessions.repository';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SESSIONS_REPOSITORY } from './sessions.types';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [SessionsController],
  providers: [
    { provide: SESSIONS_REPOSITORY, useClass: PrismaSessionsRepository },
    SessionsService,
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
