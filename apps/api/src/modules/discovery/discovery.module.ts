import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { PrismaDiscoveryRepository } from './prisma-discovery.repository';
import { DISCOVERY_REPOSITORY } from './discovery.types';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DiscoveryController],
  providers: [
    { provide: DISCOVERY_REPOSITORY, useClass: PrismaDiscoveryRepository },
    DiscoveryService,
  ],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
