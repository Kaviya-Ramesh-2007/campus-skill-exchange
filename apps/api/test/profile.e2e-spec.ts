import { VersioningType, type INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Reflector } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/platform/database/prisma.service';
import { AUTH_REPOSITORY } from '../src/modules/auth/auth.types';
import { PROFILE_REPOSITORY } from '../src/modules/users/users.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';
import { InMemoryProfileRepository } from './support/in-memory-profile.repository';

const registration = {
  displayName: 'Ada Lovelace',
  email: 'ada@example.test',
  password: 'correct horse battery staple',
};

describe('user profile API', () => {
  let app: INestApplication;
  const authRepository = new InMemoryAuthRepository();
  const profileRepository = new InMemoryProfileRepository();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(PROFILE_REPOSITORY)
      .useValue(profileRepository)
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: vi.fn(), $disconnect: vi.fn() })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.getHttpAdapter().getInstance().register(fastifyCookie);
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ZodValidationPipe(new Reflector()));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authRepository.clear();
    profileRepository.clear();
  });

  function client() {
    return request.agent(app.getHttpServer());
  }

  async function registerUser(authClient = client(), overrides: Partial<typeof registration> = {}) {
    const response = await authClient
      .post('/api/v1/auth/register')
      .send({ ...registration, ...overrides })
      .expect(201);
    const user = response.body.data.user as { id: string; displayName: string };
    profileRepository.setUser(user.id, user.displayName);
    return { authClient, user };
  }

  it('requires authentication for the current profile and profile modifications', async () => {
    const response = await client().get('/api/v1/profile').expect(401);
    const update = await client()
      .patch('/api/v1/profile')
      .send({ department: 'Design' })
      .expect(401);

    expect(response.body.error.code).toBe('AUTH_SESSION_REQUIRED');
    expect(update.body.error.code).toBe('AUTH_SESSION_REQUIRED');
  });

  it('creates, retrieves, and initializes a profile for the current user', async () => {
    const { authClient } = await registerUser();

    const missing = await authClient.get('/api/v1/profile').expect(404);
    expect(missing.body.error.code).toBe('PROFILE_NOT_FOUND');

    const created = await authClient
      .post('/api/v1/profile')
      .send({
        displayName: 'Ada, Profile',
        department: 'Computer Science',
        academicYear: 'Third year',
        institution: 'Example University',
        bio: 'I enjoy making useful things.',
        profileImageUrl: 'https://cdn.example.test/avatars/ada.png',
        interests: ['Mathematics', 'mathematics', 'Mentoring'],
        githubUrl: 'https://github.com/example',
        portfolioUrl: 'https://example.test/portfolio',
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      displayName: 'Ada, Profile',
      department: 'Computer Science',
      academicYear: 'Third year',
      institution: 'Example University',
      bio: 'I enjoy making useful things.',
      interests: ['Mathematics', 'Mentoring'],
      visibility: 'PUBLIC',
    });
    expect(created.body.data).not.toHaveProperty('email');
    expect(created.body.data).not.toHaveProperty('passwordHash');
    expect(created.body.data).not.toHaveProperty('session');

    const retrieved = await authClient.get('/api/v1/profile').expect(200);
    expect(retrieved.body.data.id).toBe(created.body.data.id);
    expect(retrieved.body.data.userId).toBe(created.body.data.userId);
  });

  it('rejects duplicate profile initialization and sensitive fields', async () => {
    const { authClient, user } = await registerUser();

    await authClient.post('/api/v1/profile').send({ department: 'Design' }).expect(201);
    const duplicate = await authClient
      .post('/api/v1/profile')
      .send({ department: 'Design' })
      .expect(409);
    expect(duplicate.body.error.code).toBe('PROFILE_ALREADY_EXISTS');

    const sensitive = await authClient
      .post('/api/v1/profile')
      .send({ email: 'other@example.test', role: 'ADMIN', accountStatus: 'SUSPENDED' })
      .expect(400);
    expect(sensitive.body.error.code).toBe('PROFILE_INVALID_INPUT');

    const protectedUpdate = await authClient
      .patch('/api/v1/profile')
      .send({ role: 'ADMIN', accountStatus: 'SUSPENDED', email: 'other@example.test' })
      .expect(400);
    expect(protectedUpdate.body.error.code).toBe('PROFILE_INVALID_INPUT');
    expect(profileRepository.getProfile(user.id)?.department).toBe('Design');
  });

  it('updates only the current profile and emits a transactional event abstraction', async () => {
    const { authClient, user } = await registerUser();
    await authClient.post('/api/v1/profile').send({ visibility: 'PUBLIC' }).expect(201);

    const updated = await authClient
      .patch('/api/v1/profile')
      .send({
        displayName: 'Ada L.',
        department: '  Computer Science  ',
        interests: ['  Web development ', 'web development', '  Sharing '],
        visibility: 'PRIVATE',
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      userId: user.id,
      displayName: 'Ada L.',
      department: 'Computer Science',
      interests: ['Web development', 'Sharing'],
      visibility: 'PRIVATE',
    });

    const event = profileRepository.getEvents()[0];
    expect(event).toMatchObject({
      eventType: 'PROFILE_UPDATED',
      entityType: 'Profile',
      entityId: updated.body.data.id,
      actorId: user.id,
      payload: { userId: user.id, visibility: 'PRIVATE' },
    });
    expect(JSON.stringify(event)).not.toContain('Computer Science');
  });

  it('does not allow a user to modify another user profile', async () => {
    const owner = await registerUser(client(), { email: 'owner@example.test' });
    const other = await registerUser(client(), {
      displayName: 'Grace Hopper',
      email: 'grace@example.test',
    });
    await owner.authClient.post('/api/v1/profile').send({ department: 'Physics' }).expect(201);

    const forbidden = await other.authClient
      .patch(`/api/v1/users/${owner.user.id}/profile`)
      .send({ department: 'Changed without ownership' })
      .expect(403);

    expect(forbidden.body.error.code).toBe('PROFILE_FORBIDDEN');
    expect(profileRepository.getProfile(owner.user.id)?.department).toBe('Physics');
  });

  it('allows an ADMIN to use the existing role framework for profile updates', async () => {
    const owner = await registerUser(client(), { email: 'owner-admin-target@example.test' });
    const admin = await registerUser(client(), {
      displayName: 'Platform Admin',
      email: 'admin-profile@example.test',
    });
    authRepository.grantRole(admin.user.id, 'ADMIN');
    await owner.authClient.post('/api/v1/profile').send({ department: 'Physics' }).expect(201);

    const response = await admin.authClient
      .patch(`/api/v1/users/${owner.user.id}/profile`)
      .send({ department: 'Mathematics' })
      .expect(200);

    expect(response.body.data.department).toBe('Mathematics');
  });

  it('returns only public profiles and does not expose authentication data', async () => {
    const owner = await registerUser(client(), { email: 'public-profile@example.test' });
    await owner.authClient
      .post('/api/v1/profile')
      .send({ bio: 'Public introduction', displayName: 'Public Ada' })
      .expect(201);

    const publicResponse = await client().get(`/api/v1/users/${owner.user.id}/profile`).expect(200);
    expect(publicResponse.body.data).toMatchObject({
      userId: owner.user.id,
      displayName: 'Public Ada',
      bio: 'Public introduction',
    });
    expect(publicResponse.body.data).not.toHaveProperty('email');
    expect(publicResponse.body.data).not.toHaveProperty('passwordHash');
    expect(publicResponse.body.data).not.toHaveProperty('session');

    await owner.authClient.patch('/api/v1/profile').send({ visibility: 'PRIVATE' }).expect(200);
    const privateResponse = await client()
      .get(`/api/v1/users/${owner.user.id}/profile`)
      .expect(404);
    expect(privateResponse.body.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('rejects invalid URLs, unsafe image references, and overlong profile data', async () => {
    const { authClient } = await registerUser();

    const invalid = await authClient
      .post('/api/v1/profile')
      .send({
        profileImageUrl: 'file:///tmp/avatar.png',
        githubUrl: 'javascript:alert(1)',
        portfolioUrl: 'not-a-url',
        bio: 'x'.repeat(2001),
      })
      .expect(400);

    expect(invalid.body.error.code).toBe('PROFILE_INVALID_INPUT');
    expect(await authClient.get('/api/v1/profile').expect(404)).toBeTruthy();
  });
});
