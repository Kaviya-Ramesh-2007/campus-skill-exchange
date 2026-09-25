import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OUTBOX_WRITER } from './outbox-contracts';
import { PrismaOutboxWriter } from './prisma-outbox.writer';

@Module({
  imports: [DatabaseModule],
  providers: [{ provide: OUTBOX_WRITER, useClass: PrismaOutboxWriter }],
  exports: [OUTBOX_WRITER],
})
export class OutboxModule {}
