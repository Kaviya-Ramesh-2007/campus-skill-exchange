import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaRatingsRepository } from './prisma-ratings.repository';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { RATINGS_REPOSITORY } from './ratings.types';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [RatingsController],
  providers: [{ provide: RATINGS_REPOSITORY, useClass: PrismaRatingsRepository }, RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
