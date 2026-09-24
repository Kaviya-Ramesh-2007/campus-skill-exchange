import { Module } from '@nestjs/common';
import { HealthController, ReadinessController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController, ReadinessController],
  providers: [HealthService],
})
export class HealthModule {}
