import { Inject, Injectable } from '@nestjs/common';
import type { EventEnvelope } from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import { PrismaService } from '../database/prisma.service';
import { type OutboxClient, type OutboxWriter } from './outbox-contracts';

@Injectable()
export class PrismaOutboxWriter implements OutboxWriter {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enqueue(event: EventEnvelope, client?: OutboxClient): Promise<void> {
    const database = client ?? this.prisma;
    await database.outboxEvent.create({
      data: {
        id: event.eventId,
        eventType: event.eventType,
        idempotencyKey: event.idempotencyKey,
        version: event.version,
        aggregateType: event.entityType,
        aggregateId: event.entityId,
        actorId: event.actorId,
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt: new Date(event.occurredAt),
      },
    });
  }
}
