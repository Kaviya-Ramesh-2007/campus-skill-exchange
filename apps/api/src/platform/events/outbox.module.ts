import { Module } from '@nestjs/common';
import type { EventEnvelope } from '@campus-skill-exchange/contracts';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { OUTBOX_WRITER, type OutboxClient, type OutboxWriter } from './outbox-contracts';
import { PrismaOutboxWriter } from './prisma-outbox.writer';

/**
 * Notifications are projected from the events every module already writes, so
 * wiring them costs this single provider and no changes to the domain modules.
 * NotificationsModule does not import OutboxModule, so there is no cycle.
 */
@Module({
  imports: [DatabaseModule, NotificationsModule],
  providers: [
    PrismaOutboxWriter,
    {
      provide: OUTBOX_WRITER,
      inject: [PrismaOutboxWriter, NotificationsService],
      useFactory: (
        writer: PrismaOutboxWriter,
        notifications: NotificationsService,
      ): OutboxWriter => ({
        async enqueue(event: EventEnvelope, client?: OutboxClient) {
          await writer.enqueue(event, client);
          try {
            // Same transaction client: a notification only ever exists for an
            // event that actually committed. Failures are contained so a
            // notification can never roll back a real domain write.
            await notifications.project(event, client);
          } catch {
            // Intentionally ignored.
          }
        },
      }),
    },
  ],
  exports: [OUTBOX_WRITER],
})
export class OutboxModule {}
