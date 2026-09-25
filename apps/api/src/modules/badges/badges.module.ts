import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';
import { PrismaBadgesRepository } from './prisma-badges.repository';
import { BADGES_REPOSITORY } from './badges.types';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [BadgesController],
  providers: [{ provide: BADGES_REPOSITORY, useClass: PrismaBadgesRepository }, BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}
