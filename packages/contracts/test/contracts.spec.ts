import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  authUserSchema,
  eventEnvelopeSchema,
  paginationQuerySchema,
  registerRequestSchema,
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

  it('keeps registration input strict and free of role fields', () => {
    const input = registerRequestSchema.parse({
      displayName: 'Ada Lovelace',
      email: ' ADA@example.test ',
      password: 'correct horse battery staple',
    });

    expect(input.email).toBe('ADA@example.test');
    expect(registerRequestSchema.safeParse({ ...input, role: 'ADMIN' }).success).toBe(false);
  });

  it('exposes only safe authentication identity fields', () => {
    const result = authUserSchema.safeParse({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'ada@example.test',
      displayName: 'Ada Lovelace',
      status: 'ACTIVE',
      roles: ['USER'],
      createdAt: '2026-09-24T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(result.success && 'passwordHash' in result.data).toBe(false);
    expect(
      authUserSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        email: 'ada@example.test',
        displayName: 'Ada Lovelace',
        status: 'ACTIVE',
        roles: ['USER'],
        createdAt: '2026-09-24T00:00:00.000Z',
        passwordHash: 'must-not-be-returned',
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
