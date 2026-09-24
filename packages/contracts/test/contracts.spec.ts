import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  eventEnvelopeSchema,
  paginationQuerySchema,
  systemRoleSchema,
} from '../src';

describe('shared contracts', () => {
  it('accepts only the initial system roles', () => {
    expect(systemRoleSchema.parse('USER')).toBe('USER');
    expect(systemRoleSchema.parse('ADMIN')).toBe('ADMIN');
    expect(() => systemRoleSchema.parse('TEACHER')).toThrow();
    expect(() => systemRoleSchema.parse('STUDENT')).toThrow();
  });

  it('normalizes pagination input', () => {
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '10' })).toEqual({
      page: 2,
      pageSize: 10,
    });
  });

  it('rejects error responses without a request id', () => {
    expect(
      apiErrorResponseSchema.safeParse({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
      }).success,
    ).toBe(false);
  });

  it('requires a versioned event envelope', () => {
    const result = eventEnvelopeSchema.safeParse({
      eventId: '00000000-0000-4000-8000-000000000001',
      eventType: 'FOUNDATION_TEST_EVENT',
      version: 1,
      occurredAt: '2026-09-24T00:00:00.000Z',
      actorId: null,
      entityType: 'Infrastructure',
      entityId: 'test',
      correlationId: null,
      causationId: null,
      idempotencyKey: 'test-event-1',
      payload: {},
    });

    expect(result.success).toBe(true);
  });
});
