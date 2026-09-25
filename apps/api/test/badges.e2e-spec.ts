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
import { BADGES_REPOSITORY } from '../src/modules/badges/badges.types';
import { InMemoryAuthRepository } from './support/in-memory-auth.repository';

const definitionId = '00000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-01T12:00:00.000Z');
const definition = {
  id: definitionId,
  name: 'First Session',
  description: 'Completed a first learning session.',
  code: 'FIRST_SESSION',
  iconUrl: null,
  createdAt: now,
  updatedAt: now,
};
const badgeRepository = {
  listDefinitions: vi.fn().mockResolvedValue([definition]),
  listForUser: vi.fn().mockResolvedValue([]),
  awardBadge: vi.fn(),
  createBadgeDefinition: vi.fn(),
};

describe('Badge API', () => {
  let app: INestApplication;
  const authRepository = new InMemoryAuthRepository();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(authRepository)
      .overrideProvider(BADGES_REPOSITORY)
      .useValue(badgeRepository)
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

  it('requires authentication for both read routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/badges').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/badges/users/00000000-0000-4000-8000-000000000002')
      .expect(401);
  });

  it('returns definitions and the current user badges', async () => {
    const client = request.agent(app.getHttpServer());
    const registration = await client
      .post('/api/v1/auth/register')
      .send({
        displayName: 'Badge User',
        email: 'badge-service@example.test',
        password: 'correct horse battery staple',
      })
      .expect(201);
    const userId = registration.body.data.user.id as string;
    badgeRepository.listForUser.mockImplementation(async (requestedUserId: string) => [
      {
        id: '00000000-0000-4000-8000-000000000003',
        userId: requestedUserId,
        badgeDefinitionId: definitionId,
        awardedAt: now,
        badgeDefinition: definition,
      },
    ]);

    const definitions = await client.get('/api/v1/badges').expect(200);
    expect(definitions.body.data[0]).toMatchObject({
      id: definitionId,
      code: definition.code,
      createdAt: now.toISOString(),
    });

    const badges = await client.get(`/api/v1/badges/users/${userId}`).expect(200);
    expect(badges.body.data[0]).toMatchObject({
      userId,
      badgeDefinitionId: definitionId,
      badgeDefinition: { code: definition.code },
    });
  });

  it('does not expose a public badge-award route', async () => {
    const client = request.agent(app.getHttpServer());
    await client
      .post('/api/v1/auth/register')
      .send({
        displayName: 'No Award',
        email: 'no-badge-award@example.test',
        password: 'correct horse battery staple',
      })
      .expect(201);

    await client
      .post('/api/v1/badges')
      .send({ userId: '00000000-0000-4000-8000-000000000001', badgeDefinitionId: definitionId })
      .expect(404);
    expect(badgeRepository.awardBadge).not.toHaveBeenCalled();
  });
});
