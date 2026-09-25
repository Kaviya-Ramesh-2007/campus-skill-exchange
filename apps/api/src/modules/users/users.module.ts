import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { ProfileController, UserProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PROFILE_REPOSITORY } from './users.types';
import { PrismaProfileRepository } from './prisma-profile.repository';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [ProfileController, UserProfileController],
  providers: [{ provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository }, ProfileService],
  exports: [ProfileService],
})
export class UsersModule {}
