import { VersioningType, type INestApplication } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Reflector } from '@nestjs/core';
import fastifyCookie from '@fastify/cookie';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/platform/database/prisma.service';
import { AUTH_REPOSITORY } from '../src/modules/auth/auth.types';
import { GOOGLE_API } from '../src/modules/integrations/google/google.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';

const googleApi = {
  createAuthorizationUrl: vi.fn().mockReturnValue('https://accounts.google.test/o/oauth2/auth'),
  exchangeCode: vi.fn(),
  revokeAccessToken: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
};

describe('Google integration API', () => {
  let app: INestApplication;
  const authRepository = new InMemoryAuthRepository();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(GOOGLE_API)
      .useValue(googleApi)
      .overrideProvider(PrismaService)
      .useValue({ googleConnection: { findUnique: vi.fn().mockResolvedValue(null) } })
      .compile();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.getHttpAdapter().getInstance().register(fastifyCookie);
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ZodValidationPipe(new Reflector()));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => app.close());

  it('requires authentication for Google routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/integrations/google/connect').expect(401);
    await request(app.getHttpServer()).get('/api/v1/integrations/google/status').expect(401);
  });

  it('reports a disconnected account for an authenticated User', async () => {
    const client = request.agent(app.getHttpServer());
    await client
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Kaviya',
        email: 'google-integration@example.test',
        password: 'correct horse battery staple',
      })
      .expect(201);
    const response = await client.get('/api/v1/integrations/google/status').expect(200);
    expect(response.body.data).toEqual({ connected: false, scopes: [], expiresAt: null });
  });
});
