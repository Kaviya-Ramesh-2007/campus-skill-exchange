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
import { RATINGS_REPOSITORY } from '../src/modules/ratings/ratings.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';

const sessionId = '00000000-0000-4000-8000-000000000001';
const hostId = '00000000-0000-4000-8000-000000000002';
const partnerId = '00000000-0000-4000-8000-000000000003';
const ratingRepository = {
  findSession: vi.fn().mockResolvedValue({
    id: sessionId,
    status: 'COMPLETED',
    host: { userId: hostId, displayName: 'Host' },
    participant: { userId: partnerId, displayName: 'Partner' },
  }),
  listForSession: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
};

describe('Ratings API', () => {
  let app: INestApplication;
  const authRepository = new InMemoryAuthRepository();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(RATINGS_REPOSITORY)
      .useValue(ratingRepository)
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

  afterAll(async () => app.close());

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/ratings')
      .send({ sessionId, rating: 5 })
      .expect(401);
    await request(app.getHttpServer()).get(`/api/v1/ratings/session/${sessionId}`).expect(401);
  });

  it('returns session ratings for an authenticated participant', async () => {
    const client = request.agent(app.getHttpServer());
    const registration = await client
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Host',
        email: 'rating-host@example.test',
        password: 'correct horse battery staple',
      })
      .expect(201);
    const registeredId = registration.body.data.user.id as string;
    ratingRepository.findSession.mockResolvedValue({
      id: sessionId,
      status: 'COMPLETED',
      host: { userId: registeredId, displayName: 'Host' },
      participant: { userId: partnerId, displayName: 'Partner' },
    });
    const response = await client.get(`/api/v1/ratings/session/${sessionId}`).expect(200);
    expect(response.body.data).toEqual([]);
  });
});
