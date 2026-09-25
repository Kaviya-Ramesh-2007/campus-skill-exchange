import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { OutboxModule } from '../../platform/events/outbox.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaPaymentsRepository } from './prisma-payments.repository';
import { PAYMENTS_REPOSITORY } from './payments.types';
import { ConfiguredRazorpayProvider, RAZORPAY_PROVIDER } from './razorpay.provider';

@Module({
  imports: [DatabaseModule, OutboxModule, AuthModule],
  controllers: [PaymentsController],
  providers: [
    { provide: PAYMENTS_REPOSITORY, useClass: PrismaPaymentsRepository },
    { provide: RAZORPAY_PROVIDER, useClass: ConfiguredRazorpayProvider },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
