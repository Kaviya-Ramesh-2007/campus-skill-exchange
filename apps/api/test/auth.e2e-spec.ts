import { Controller, Get, VersioningType, type INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Reflector } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/platform/database/prisma.service';
import { Roles } from '../src/modules/auth/auth.decorators';
import { AUTH_REPOSITORY } from '../src/modules/auth/auth.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';

@Controller({ path: 'auth/test-admin', version: '1' })
@Roles('ADMIN')
class TestAdminController {
  @Get()
  check() {
    return { success: true, data: { authorized: true } };
  }
}

const validRegistration = {
  displayName: 'Ada Lovelace',
  email: 'ada@example.test',
  password: 'correct horse battery staple',
};

describe('authentication and identity API', () => {
  let app: INestApplication;
  const repository = new InMemoryAuthRepository();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestAdminController],
    })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(repository)
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
    repository.clear();
  });

  function client() {
    return request.agent(app.getHttpServer());
  }

  async function register(authClient = client()) {
    return authClient.post('/api/v1/auth/register').send(validRegistration).expect(201);
  }

  it('registers a user, assigns USER, and returns no credentials', async () => {
    const response = await register();

    expect(response.body.data.user).toMatchObject({
      email: validRegistration.email,
      displayName: validRegistration.displayName,
      status: 'ACTIVE',
      roles: ['USER'],
    });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(response.body.data.user).not.toHaveProperty('passwordCredential');
    expect(JSON.stringify(response.body)).not.toContain(validRegistration.password);
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('stores an Argon2id hash instead of the plaintext password', async () => {
    const response = await register();
    const userId = response.body.data.user.id as string;
    const passwordHash = repository.getPasswordHash(userId);

    expect(passwordHash).not.toBe(validRegistration.password);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects unsafe browser requests from an unapproved origin', async () => {
    const response = await client()
      .post('/api/v1/auth/login')
      .set('Origin', 'https://untrusted.example')
      .send({ email: validRegistration.email, password: validRegistration.password })
      .expect(403);

    expect(response.body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('rejects duplicate email addresses case-insensitively', async () => {
    await register();

    const response = await client()
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'ADA@EXAMPLE.TEST' })
      .expect(409);

    expect(response.body.error.code).toBe('AUTH_EMAIL_ALREADY_EXISTS');
  });

  it('logs in with valid credentials and rejects invalid or unknown credentials generically', async () => {
    const registration = await register();
    const userId = registration.body.data.user.id as string;
    const authClient = client();

    const success = await authClient
      .post('/api/v1/auth/login')
      .send({ email: validRegistration.email, password: validRegistration.password })
      .expect(200);
    expect(success.body.data.user.id).toBe(userId);

    const invalid = await client()
      .post('/api/v1/auth/login')
      .send({ email: validRegistration.email, password: 'wrong password' })
      .expect(401);
    const unknown = await client()
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.test', password: validRegistration.password })
      .expect(401);

    expect(invalid.body.error).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(unknown.body.error).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(invalid.body.error.message).toBe(unknown.body.error.message);
  });

  it('prevents suspended accounts from authenticating', async () => {
    const registration = await register();
    const userId = registration.body.data.user.id as string;
    repository.setUserStatus(userId, 'SUSPENDED');

    const response = await client()
      .post('/api/v1/auth/login')
      .send({ email: validRegistration.email, password: validRegistration.password })
      .expect(403);

    expect(response.body.error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
  });

  it('returns the current user and rejects unauthenticated requests', async () => {
    const authClient = client();
    await register(authClient);

    const response = await authClient.get('/api/v1/auth/me').expect(200);
    expect(response.body.data).toMatchObject({ email: validRegistration.email, roles: ['USER'] });

    const unauthenticated = await client().get('/api/v1/auth/me').expect(401);
    expect(unauthenticated.body.error.code).toBe('AUTH_SESSION_REQUIRED');
  });

  it('invalidates the session on logout', async () => {
    const authClient = client();
    await register(authClient);

    await authClient.post('/api/v1/auth/logout').expect(204);
    const response = await authClient.get('/api/v1/auth/me').expect(401);

    expect(response.body.error.code).toBe('AUTH_SESSION_REQUIRED');
  });

  it('does not allow public role assignment', async () => {
    const response = await client()
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, role: 'ADMIN' })
      .expect(400);

    expect(response.body.error.code).toBe('AUTH_INVALID_INPUT');
    expect(await repository.findUserByEmail(validRegistration.email)).toBeNull();

    const validRegistrationResponse = await register();
    expect(validRegistrationResponse.body.data.user.roles).toEqual(['USER']);
  });

  it('enforces ADMIN authorization without adding a public admin API', async () => {
    const userClient = client();
    const registration = await register(userClient);
    const userId = registration.body.data.user.id as string;

    await userClient.get('/api/v1/auth/test-admin').expect(403);
    expect((await userClient.get('/api/v1/auth/test-admin')).body.error.code).toBe(
      'AUTH_FORBIDDEN',
    );

    repository.grantRole(userId, 'ADMIN');
    const adminClient = client();
    await adminClient
      .post('/api/v1/auth/login')
      .send({ email: validRegistration.email, password: validRegistration.password })
      .expect(200);

    const response = await adminClient.get('/api/v1/auth/test-admin').expect(200);
    expect(response.body.data.authorized).toBe(true);
  });
});
