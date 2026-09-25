import { describe, expect, it } from 'vitest';
import {
  apiErrorResponseSchema,
  authUserSchema,
  eventEnvelopeSchema,
  paginationQuerySchema,
  profileResponseSchema,
  profileUpdatedEventDefinition,
  registerRequestSchema,
  systemRoleSchema,
  createProfileRequestSchema,
  updateProfileRequestSchema,
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

  it('normalizes profile defaults and keeps profile writes strict', () => {
    const result = createProfileRequestSchema.parse({ department: '  Computer Science  ' });

    expect(result).toMatchObject({
      department: 'Computer Science',
      interests: [],
      visibility: 'PUBLIC',
    });
    expect(createProfileRequestSchema.safeParse({ role: 'ADMIN' }).success).toBe(false);
    expect(updateProfileRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProfileRequestSchema.parse({ department: null })).toEqual({ department: null });
  });

  it('rejects unsafe profile URLs and control characters', () => {
    expect(
      createProfileRequestSchema.safeParse({ profileImageUrl: 'file:///tmp/avatar.png' }).success,
    ).toBe(false);
    expect(createProfileRequestSchema.safeParse({ githubUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(
      createProfileRequestSchema.safeParse({ portfolioUrl: 'https://user:password@example.test' })
        .success,
    ).toBe(false);
    expect(createProfileRequestSchema.safeParse({ department: `Math\u0000ematics` }).success).toBe(
      false,
    );
  });

  it('keeps the profile response free of authentication fields', () => {
    const safeProfile = {
      id: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      displayName: 'Ada Lovelace',
      department: 'Computer Science',
      academicYear: null,
      institution: null,
      bio: null,
      profileImageUrl: null,
      interests: [],
      githubUrl: null,
      portfolioUrl: null,
      visibility: 'PUBLIC',
      createdAt: '2026-09-24T00:00:00.000Z',
      updatedAt: '2026-09-24T00:00:00.000Z',
    };

    const result = profileResponseSchema.safeParse(safeProfile);
    expect(result.success).toBe(true);
    expect(result.success && 'email' in result.data).toBe(false);
    expect(
      profileResponseSchema.safeParse({ ...safeProfile, email: 'must-not@example.test' }).success,
    ).toBe(false);
    expect(profileUpdatedEventDefinition).toMatchObject({
      name: 'PROFILE_UPDATED',
      version: 1,
      ownerModule: 'users',
    });
  });
});
