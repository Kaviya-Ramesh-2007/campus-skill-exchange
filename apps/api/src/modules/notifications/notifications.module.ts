import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { DomainEventNotificationProjector } from './notification-projector';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaNotificationsRepository } from './prisma-notifications.repository';
import { NOTIFICATION_PROJECTOR, NOTIFICATIONS_REPOSITORY } from './notifications.types';

/**
 * Deliberately does NOT import OutboxModule: the shared outbox writer depends on
 * this module's projector, so importing it back would create a cycle.
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATIONS_REPOSITORY, useClass: PrismaNotificationsRepository },
    { provide: NOTIFICATION_PROJECTOR, useClass: DomainEventNotificationProjector },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
