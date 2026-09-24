import type { EventEnvelope } from '@campus-skill-exchange/contracts';

export const OUTBOX_WRITER = Symbol('OUTBOX_WRITER');

export interface OutboxWriter {
  enqueue(event: EventEnvelope): Promise<void>;
}

export interface OutboxProcessor {
  processPending(limit: number): Promise<number>;
}
