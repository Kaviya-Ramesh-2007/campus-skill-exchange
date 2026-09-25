import type { EventEnvelope } from '@campus-skill-exchange/contracts';
import type { Prisma } from '@campus-skill-exchange/database';
import type { PrismaService } from '../database/prisma.service';

export const OUTBOX_WRITER = Symbol('OUTBOX_WRITER');

export type OutboxClient = Prisma.TransactionClient | PrismaService;

export interface OutboxWriter {
  /**
   * Persist an event using the supplied transaction client when a domain
   * operation is already inside a transaction. This keeps the entity change
   * and its event atomic without exposing a queue or a second event system.
   */
  enqueue(event: EventEnvelope, client?: OutboxClient): Promise<void>;
}

export interface OutboxProcessor {
  processPending(limit: number): Promise<number>;
}
