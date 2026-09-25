import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { MatchingController, ExchangesController } from './matching.controller';
import { MatchingService } from './matching.service';
import { MutualExchangeService } from './mutual-exchange.service';
import { PrismaMatchingRepository } from './prisma-matching.repository';
import { MATCH_REPOSITORY } from './matching.types';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MatchingController, ExchangesController],
  providers: [
    { provide: MATCH_REPOSITORY, useClass: PrismaMatchingRepository },
    MutualExchangeService,
    MatchingService,
  ],
  exports: [MatchingService, MutualExchangeService],
})
export class MatchingModule {}
